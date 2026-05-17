import Anthropic from "@anthropic-ai/sdk";
import type { Queue, Worker } from "bullmq";
import { Queue as BullQueue, Worker as BullWorker } from "bullmq";
import type { Redis } from "ioredis";
import process from "node:process";
import { prisma } from "../../db/index";
import { generateDailyDigestEmail } from "../../templates/dailyDigestEmail";

const DIGEST_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_LANG = "pl";
const DAILY_DIGEST_QUEUE_NAME = "daily-digest-email";
const DAILY_DIGEST_JOB_NAME = "dailyDigestEmail";
const DAILY_DIGEST_WORD_LIMIT = 150;

type DigestResult = {
  digest: string;
  date: string;
};

type SignalSnapshot = {
  ticker: string;
  pattern_type: string;
  confidence: number;
  score: number | null;
  brief_pl: string | null;
  brief_en: string | null;
  narrativeRisk: string | null;
};

type OpenPosition = {
  ticker: string;
  direction: "LONG" | "SHORT";
  quantity: number;
  entryPrice: number;
  pnl: number | null;
  pnlPct: number | null;
};

type DigestModuleDeps = {
  db: typeof prisma;
  fetchImpl: typeof fetch;
  createClient: (apiKey: string) => Anthropic;
  now: () => Date;
};

type PortfolioSummary = {
  openPositions: number;
  grossExposure: number;
  totalPnl: number;
  avgPnlPct: number;
};

const defaultDeps: DigestModuleDeps = {
  db: prisma,
  fetchImpl: fetch,
  createClient: (apiKey) => new Anthropic({ apiKey }),
  now: () => new Date(),
};

function utcDateOnly(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function normalizeLang(langInput?: string): string {
  const normalized = String(langInput ?? DEFAULT_LANG).trim().toLowerCase();
  return normalized || DEFAULT_LANG;
}

function clipToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function summarizePortfolio(positions: OpenPosition[]): PortfolioSummary {
  if (positions.length === 0) {
    return {
      openPositions: 0,
      grossExposure: 0,
      totalPnl: 0,
      avgPnlPct: 0,
    };
  }

  const grossExposure = positions.reduce((acc, row) => acc + row.entryPrice * row.quantity, 0);
  const pnlValues = positions.map((row) => Number(row.pnl)).filter((value) => Number.isFinite(value));
  const pnlPctValues = positions.map((row) => Number(row.pnlPct)).filter((value) => Number.isFinite(value));

  const totalPnl = pnlValues.reduce((acc, value) => acc + value, 0);
  const avgPnlPct = pnlPctValues.length > 0 ? pnlPctValues.reduce((acc, value) => acc + value, 0) / pnlPctValues.length : 0;

  return {
    openPositions: positions.length,
    grossExposure: round2(grossExposure),
    totalPnl: round2(totalPnl),
    avgPnlPct: round2(avgPnlPct),
  };
}

function signalDescription(signal: SignalSnapshot, lang: string): string {
  const localizedBrief = lang.startsWith("pl") ? signal.brief_pl : signal.brief_en;
  const fallback = `${signal.ticker} (${signal.pattern_type}, confidence ${signal.confidence}%, risk score ${signal.score ?? 0})`;
  return localizedBrief?.trim() ? `${signal.ticker}: ${localizedBrief.trim()}` : fallback;
}

function buildPrompt(input: {
  lang: string;
  signals: SignalSnapshot[];
  positions: OpenPosition[];
  portfolio: PortfolioSummary;
}): string {
  const signalsBlock =
    input.signals.length > 0
      ? input.signals.map((signal, idx) => `${idx + 1}. ${signalDescription(signal, input.lang)}`).join("\n")
      : "Brak nowych sygnałów w ostatnich 24h.";

  const positionsBlock =
    input.positions.length > 0
      ? input.positions
          .slice(0, 5)
          .map(
            (position, idx) =>
              `${idx + 1}. ${position.ticker} ${position.direction} qty=${position.quantity}, entry=${round2(position.entryPrice)}, pnl=${round2(position.pnl ?? 0)} (${round2(position.pnlPct ?? 0)}%)`,
          )
          .join("\n")
      : "Brak otwartych pozycji paper trading.";

  const localizedGreetingInstruction = input.lang.startsWith("pl")
    ? 'Rozpocznij dokładnie zdaniem: "Dzień dobry! Oto Twój dzienny przegląd rynku..."'
    : "Start with a localized equivalent of this phrase: Dzień dobry! Oto Twój dzienny przegląd rynku...";

  return [
    "Napisz pojedynczą narrację Daily Digest dla inwestora.",
    `Język odpowiedzi: ${input.lang}.`,
    localizedGreetingInstruction,
    `Maksymalnie ${DAILY_DIGEST_WORD_LIMIT} słów.`,
    "Użyj ciepłego, profesjonalnego tonu i konkretów.",
    "Wymagane sekcje (w jednej spójnej narracji, bez list markdown):",
    "1) Top 3 sygnały z ostatnich 24h z krótkim opisem każdego.",
    "2) Stan portfela paper trading (otwarte pozycje + podsumowanie).",
    "3) Jeden tip behawioralny na dziś.",
    "",
    "DANE WEJŚCIOWE:",
    "TOP SYGNAŁY:",
    signalsBlock,
    "",
    "OTWARTE POZYCJE:",
    positionsBlock,
    "",
    "PODSUMOWANIE PORTFELA:",
    `open_positions=${input.portfolio.openPositions}, gross_exposure=${input.portfolio.grossExposure}, total_pnl=${input.portfolio.totalPnl}, avg_pnl_pct=${input.portfolio.avgPnlPct}`,
  ].join("\n");
}

function extractClaudeText(content: Anthropic.Messages.Message["content"]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

async function resolvePreferredLanguage(db: typeof prisma, userId: string): Promise<string> {
  try {
    const rows = await db.$queryRaw<Array<{ lang: string | null }>>`
      SELECT language AS lang
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const lang = rows[0]?.lang?.trim();
    if (lang) return normalizeLang(lang);
  } catch {
    // Fallback for environments where user_settings.language column does not exist.
  }

  try {
    const rows = await db.$queryRaw<Array<{ lang: string | null }>>`
      SELECT language AS lang
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const lang = rows[0]?.lang?.trim();
    if (lang) return normalizeLang(lang);
  } catch {
    // Fallback for environments where users.language column does not exist.
  }

  return DEFAULT_LANG;
}

async function generateDigestNarration(input: {
  lang: string;
  signals: SignalSnapshot[];
  positions: OpenPosition[];
  portfolio: PortfolioSummary;
  deps: DigestModuleDeps;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const prompt = buildPrompt({
    lang: input.lang,
    signals: input.signals,
    positions: input.positions,
    portfolio: input.portfolio,
  });
  const client = input.deps.createClient(apiKey);
  const response = await client.messages.create({
    model: DIGEST_MODEL,
    max_tokens: 450,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = extractClaudeText(response.content);
  if (!raw) throw new Error("Claude digest response was empty");
  return clipToWordLimit(raw, DAILY_DIGEST_WORD_LIMIT);
}

async function resolveRecipient(db: typeof prisma, userId: string): Promise<{ email: string; name: string | null }> {
  const fallback = process.env.DIGEST_TEST_EMAIL?.trim();
  if (fallback) return { email: fallback, name: null };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email?.trim()) {
    throw new Error(`Missing email for user ${userId}`);
  }
  return { email: user.email.trim(), name: user.name ?? null };
}

async function sendWithResend(
  deps: DigestModuleDeps,
  input: {
    to: string;
    digest: DigestResult;
    name: string | null;
    lang: string;
  },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const subject = `StockAI Pro — Twój dzienny przegląd [${input.digest.date}]`;
  const html = generateDailyDigestEmail({
    digest: input.digest.digest,
    date: input.digest.date,
    name: input.name,
    lang: input.lang,
  });

  const response = await deps.fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "digest@stock-ai.pro",
      to: [input.to],
      subject,
      text: input.digest.digest,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

function withDeps(depsInput?: Partial<DigestModuleDeps>): DigestModuleDeps {
  return {
    db: depsInput?.db ?? defaultDeps.db,
    fetchImpl: depsInput?.fetchImpl ?? defaultDeps.fetchImpl,
    createClient: depsInput?.createClient ?? defaultDeps.createClient,
    now: depsInput?.now ?? defaultDeps.now,
  };
}

export async function buildDailyDigest(
  userIdInput: string,
  langInput?: string,
  depsInput?: Partial<DigestModuleDeps>,
): Promise<DigestResult> {
  const deps = withDeps(depsInput);
  const userId = String(userIdInput ?? "").trim();
  if (!userId) throw new Error("Missing userId");

  const now = deps.now();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lang = langInput?.trim() ? normalizeLang(langInput) : await resolvePreferredLanguage(deps.db, userId);

  const [signals, openPositions] = await Promise.all([
    deps.db.signal.findMany({
      where: {
        created_at: { gte: since },
        score: { not: null },
      },
      orderBy: [{ score: "desc" }, { created_at: "desc" }],
      take: 3,
      select: {
        ticker: true,
        pattern_type: true,
        confidence: true,
        score: true,
        brief_pl: true,
        brief_en: true,
        narrativeRisk: true,
      },
    }),
    deps.db.paperTrade.findMany({
      where: {
        userId,
        status: "OPEN",
      },
      orderBy: { entryAt: "desc" },
      select: {
        ticker: true,
        direction: true,
        quantity: true,
        entryPrice: true,
        pnl: true,
        pnlPct: true,
      },
    }),
  ]);

  const portfolio = summarizePortfolio(openPositions);
  const digestText = await generateDigestNarration({
    lang,
    signals,
    positions: openPositions,
    portfolio,
    deps,
  });

  return {
    digest: digestText,
    date: utcDateOnly(now),
  };
}

export async function generateDailyDigest(
  userId: string,
  depsInput?: Partial<DigestModuleDeps>,
): Promise<string> {
  const payload = await buildDailyDigest(userId, undefined, depsInput);
  return payload.digest;
}

export async function sendDailyDigest(
  userIdInput: string,
  langInput?: string,
  depsInput?: Partial<DigestModuleDeps>,
): Promise<DigestResult> {
  const deps = withDeps(depsInput);
  const userId = String(userIdInput ?? "").trim();
  if (!userId) throw new Error("Missing userId");

  const lang = langInput?.trim() ? normalizeLang(langInput) : await resolvePreferredLanguage(deps.db, userId);
  const digest = await buildDailyDigest(userId, lang, deps);
  const recipient = await resolveRecipient(deps.db, userId);
  await sendWithResend(deps, {
    to: recipient.email,
    digest,
    name: recipient.name,
    lang,
  });
  return digest;
}

export async function sendDailyDigests(depsInput?: Partial<DigestModuleDeps>): Promise<{ sent: number; failed: number }> {
  const deps = withDeps(depsInput);
  const users = await deps.db.user.findMany({
    where: { emailVerified: true },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendDailyDigest(user.id, undefined, deps);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[digest] Failed for user ${user.id}:`, error);
    }
  }

  return { sent, failed };
}

export function registerDailyDigestJob(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new BullQueue(DAILY_DIGEST_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
    },
  });

  const worker = new BullWorker(
    DAILY_DIGEST_QUEUE_NAME,
    async (job) => {
      if (job.name !== DAILY_DIGEST_JOB_NAME) return;
      const result = await sendDailyDigests();
      console.log(`[digest] sendDailyDigests done sent=${result.sent} failed=${result.failed}`);
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[digest] job ${job?.id} failed`, err);
  });

  return { queue, worker };
}

export async function scheduleDailyDigestJob(queue: Queue): Promise<void> {
  await queue.add(
    DAILY_DIGEST_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 8 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-digest-8am-utc",
    },
  );
}
