import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const DIGEST_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_LANG = "pl";

type DigestResult = {
  digest: string;
  date: string;
};

type PaperTradeRow = {
  ticker: string;
  pnlPct: number | null;
};

type SignalRow = {
  ticker: string;
  pattern_type: string;
  confidence: number;
};

function utcDateOnly(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function normalizeLang(langInput?: string): string {
  const normalized = String(langInput ?? DEFAULT_LANG).trim();
  return normalized || DEFAULT_LANG;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function computePortfolioChangePct(trades: PaperTradeRow[]): number {
  const values = trades
    .map((trade) => Number(trade.pnlPct))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  const avg = values.reduce((acc, value) => acc + value, 0) / values.length;
  return round2(avg);
}

function summarizeSignals(signals: SignalRow[]): string {
  if (signals.length === 0) return "none";
  return signals
    .map((signal) => `${signal.ticker} ${signal.pattern_type} (${signal.confidence}%)`)
    .join(", ");
}

function extractText(content: Anthropic.Messages.Message["content"]): string {
  const textParts = content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return textParts;
}

function parseDigestJson(rawText: string): DigestResult {
  const candidate = rawText.match(/\{[\s\S]*\}/)?.[0] ?? rawText;
  const parsed = JSON.parse(candidate) as Partial<DigestResult>;
  const digest = String(parsed.digest ?? "").trim();
  const date = String(parsed.date ?? "").trim() || utcDateOnly();
  if (!digest) {
    throw new Error("Claude digest response did not include digest text");
  }
  return { digest, date };
}

async function generateDigestWithClaude(lang: string, portfolioChangePct: number, signalsSummary: string): Promise<DigestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const prompt = `Write a friendly 60-word daily investment digest in ${lang}.
Portfolio change: ${portfolioChangePct}%. New signals: ${signalsSummary}.
Write as narrative, not bullet points. Encouraging tone.
Return strict JSON only: {"digest":"...","date":"YYYY-MM-DD"}.`;

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: DIGEST_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = extractText(response.content);
  return parseDigestJson(rawText);
}

async function resolveRecipientEmail(userId: string): Promise<string> {
  const fallback = process.env.DIGEST_TEST_EMAIL?.trim();
  if (fallback) return fallback;

  try {
    const rows = await prisma.$queryRaw<{ email: string | null }[]>`
      SELECT email FROM users WHERE id = ${userId} LIMIT 1
    `;
    const email = rows[0]?.email?.trim();
    if (email) return email;
  } catch {
    // Keep compatibility if users.email is not present in current schema.
  }

  return `${userId}@stock-ai.pro`;
}

async function sendWithResend(to: string, digest: DigestResult): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "digest@stock-ai.pro",
      to: [to],
      subject: `Twój dzienny digest — ${digest.date}`,
      text: digest.digest,
      html: `<p>${digest.digest}</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

export async function buildDailyDigest(userIdInput: string, langInput?: string): Promise<DigestResult> {
  const userId = String(userIdInput ?? "").trim();
  if (!userId) throw new Error("Missing userId");

  const lang = normalizeLang(langInput);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const trades = await prisma.paperTrade.findMany({
    where: {
      userId,
      OR: [{ entryAt: { gte: since } }, { exitAt: { gte: since } }],
    },
    select: {
      ticker: true,
      pnlPct: true,
    },
    orderBy: { entryAt: "desc" },
  });

  const tickers = [...new Set(trades.map((trade) => trade.ticker.trim().toUpperCase()).filter(Boolean))];
  const signals = tickers.length
    ? await prisma.signal.findMany({
        where: { ticker: { in: tickers } },
        orderBy: { created_at: "desc" },
        take: 3,
        select: {
          ticker: true,
          pattern_type: true,
          confidence: true,
        },
      })
    : [];

  const portfolioChangePct = computePortfolioChangePct(trades);
  const signalsSummary = summarizeSignals(signals);

  const generated = await generateDigestWithClaude(lang, portfolioChangePct, signalsSummary);
  return {
    digest: generated.digest,
    date: generated.date || utcDateOnly(now),
  };
}

export async function sendDailyDigest(userId: string, langInput?: string): Promise<DigestResult> {
  const digest = await buildDailyDigest(userId, langInput);
  const recipient = await resolveRecipientEmail(userId);
  await sendWithResend(recipient, digest);
  return digest;
}

export async function sendDailyDigests(langInput?: string): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendDailyDigest(user.id, langInput);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[digest] Failed for user ${user.id}:`, error);
    }
  }

  return { sent, failed };
}
