import Anthropic from "@anthropic-ai/sdk";
import { Queue, Worker } from "bullmq";
import { prisma } from "../../db/index";
import { getMarketRegime } from "../../marketRegime";
import { getCacheRedis } from "../../redis";

export type AlphaWindow = {
  ticker: string;
  windowStart: Date;
  windowEnd: Date;
  type: "EARNINGS_CYCLE" | "SEASONAL" | "SECTOR_ROTATION" | "REGIME_SHIFT";
  probabilityScore: number;
  historicalAvgReturn: number;
  description: string;
  aiNote: string;
};

type MarketAlphaCalendar = {
  windows: AlphaWindow[];
  topOpportunity: AlphaWindow | null;
  aiSummary: string;
};

const ALPHA_CALENDAR_QUEUE_NAME = "alpha-calendar";
const ALPHA_CALENDAR_JOB_NAME = "alphaCalendar";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateOnly(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function localAiNote(window: Omit<AlphaWindow, "aiNote">): string {
  return `${window.ticker}: ${window.type} z historycznym wynikiem ${window.historicalAvgReturn.toFixed(2)}% i oceną ${window.probabilityScore}/100.`;
}

async function aiWindowNote(window: Omit<AlphaWindow, "aiNote">): Promise<string> {
  const fallback = localAiNote(window);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const client = new Anthropic({ apiKey });
    const prompt = `Ticker: ${window.ticker}. Typ okna: ${window.type}. Probability score: ${window.probabilityScore}/100. Średni historyczny wynik: ${window.historicalAvgReturn.toFixed(2)}%. Opis: ${window.description}. Napisz jedną, konkretną notkę po polsku (max 2 zdania).`;
    const msg = await client.messages.create({
      model,
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim().replace(/\s+/g, " ") : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

function scoreFromAvg(avgReturn: number, maxAvg: number): number {
  if (!Number.isFinite(avgReturn) || !Number.isFinite(maxAvg) || maxAvg <= 0) return 0;
  return clampScore((avgReturn / maxAvg) * 100);
}

async function buildEarningsWindow(ticker: string): Promise<AlphaWindow | null> {
  try {
    const now = new Date();
    const end = addDays(now, 7);
    const rows = await prisma.$queryRaw<Array<{ earnings_date: Date }>>`
      SELECT earnings_date
      FROM earnings_calendar
      WHERE ticker = ${ticker.toUpperCase()}
        AND earnings_date >= ${toDateOnly(now)}
        AND earnings_date <= ${toDateOnly(end)}
      ORDER BY earnings_date ASC
      LIMIT 1
    `;
    const nearest = rows[0];
    if (!nearest?.earnings_date) return null;

    const hist = await prisma.$queryRaw<Array<{ avg_return: number | null }>>`
      SELECT AVG(return_1d_pct)::float AS avg_return
      FROM (
        SELECT return_1d_pct
        FROM earnings_reactions
        WHERE ticker = ${ticker.toUpperCase()}
        ORDER BY earnings_date DESC
        LIMIT 4
      ) t
    `;
    const historicalAvgReturn = Number(hist[0]?.avg_return ?? 0);
    const base: Omit<AlphaWindow, "aiNote"> = {
      ticker: ticker.toUpperCase(),
      windowStart: addDays(new Date(nearest.earnings_date), -3),
      windowEnd: addDays(new Date(nearest.earnings_date), 1),
      type: "EARNINGS_CYCLE",
      probabilityScore: clampScore(50 + historicalAvgReturn * 10),
      historicalAvgReturn,
      description: "Okno wokół publikacji wyników kwartalnych (3 dni przed do 1 dnia po).",
    };
    return { ...base, aiNote: await aiWindowNote(base) };
  } catch {
    return null;
  }
}

async function buildSeasonalWindow(ticker: string): Promise<AlphaWindow | null> {
  try {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const from = new Date(Date.UTC(now.getUTCFullYear() - 3, month - 1, 1));
    const monthAvgRows = await prisma.$queryRaw<Array<{ avg_return: number | null; max_avg: number | null }>>`
      WITH monthly AS (
        SELECT
          EXTRACT(MONTH FROM timestamp)::int AS m,
          AVG(
            CASE
              WHEN open > 0 THEN ((close - open) / open) * 100
              ELSE 0
            END
          )::float AS avg_return
        FROM quotes
        WHERE symbol = ${ticker.toUpperCase()}
          AND timestamp >= ${from}
        GROUP BY m
      )
      SELECT
        COALESCE((SELECT avg_return FROM monthly WHERE m = ${month}), 0)::float AS avg_return,
        COALESCE((SELECT MAX(avg_return) FROM monthly), 0)::float AS max_avg
    `;
    const avg = Number(monthAvgRows[0]?.avg_return ?? 0);
    const maxAvg = Number(monthAvgRows[0]?.max_avg ?? 0);
    if (avg <= 2) return null;
    const base: Omit<AlphaWindow, "aiNote"> = {
      ticker: ticker.toUpperCase(),
      windowStart: toDateOnly(now),
      windowEnd: addDays(toDateOnly(now), 30),
      type: "SEASONAL",
      probabilityScore: scoreFromAvg(avg, maxAvg),
      historicalAvgReturn: avg,
      description: "Sezonowość miesiąca historycznie wspiera dodatnią stopę zwrotu.",
    };
    return { ...base, aiNote: await aiWindowNote(base) };
  } catch {
    return null;
  }
}

function isGrowthSector(sector: string): boolean {
  const s = sector.toLowerCase();
  return s.includes("tech") || s.includes("information") || s.includes("communication") || s.includes("consumer discretionary");
}

function isDefensiveSector(sector: string): boolean {
  const s = sector.toLowerCase();
  return s.includes("utilities") || s.includes("health") || s.includes("consumer staples") || s.includes("real estate");
}

async function buildSectorRotationWindow(ticker: string): Promise<AlphaWindow | null> {
  const company = await prisma.company.findUnique({
    where: { symbol: ticker.toUpperCase() },
    select: { sector: true },
  });
  const regime = await getMarketRegime(ticker.toUpperCase());
  const sector = (company?.sector ?? "").trim();
  if (!sector) return null;

  const favoredGrowth = regime.regime === "RISK_ON" && isGrowthSector(sector);
  const favoredDefensive = regime.regime === "RISK_OFF" && isDefensiveSector(sector);
  if (!favoredGrowth && !favoredDefensive) return null;

  const base: Omit<AlphaWindow, "aiNote"> = {
    ticker: ticker.toUpperCase(),
    windowStart: new Date(),
    windowEnd: addDays(new Date(), 5),
    type: "SECTOR_ROTATION",
    probabilityScore: clampScore(55 + regime.confidence * 0.35),
    historicalAvgReturn: 0,
    description: `Reżim ${regime.regime} faworyzuje sektor ${sector}.`,
  };
  return { ...base, aiNote: await aiWindowNote(base) };
}

async function buildRegimeShiftWindow(ticker: string): Promise<AlphaWindow | null> {
  const redis = getCacheRedis();
  const key = `alpha_calendar:regime:last:${ticker.toUpperCase()}`;
  const regime = await getMarketRegime(ticker.toUpperCase());
  const prevRaw = await redis.get(key);
  const now = new Date();
  await redis.set(
    key,
    JSON.stringify({ regime: regime.regime, ts: now.toISOString() }),
    "EX",
    60 * 60 * 24,
  );
  if (!prevRaw) return null;
  try {
    const prev = JSON.parse(prevRaw) as { regime?: string; ts?: string };
    const prevTs = prev.ts ? new Date(prev.ts).getTime() : 0;
    const changedRecently =
      prev.regime && prev.regime !== regime.regime && Date.now() - prevTs <= 24 * 60 * 60 * 1000;
    if (!changedRecently) return null;
    const hist = await prisma.$queryRaw<Array<{ avg_reaction: number | null }>>`
      SELECT AVG(reaction_pct)::float AS avg_reaction
      FROM regime_shift_reactions
      WHERE ticker = ${ticker.toUpperCase()}
      ORDER BY observed_at DESC
      LIMIT 20
    `;
    const historicalAvgReturn = Number(hist[0]?.avg_reaction ?? 0);
    const base: Omit<AlphaWindow, "aiNote"> = {
      ticker: ticker.toUpperCase(),
      windowStart: now,
      windowEnd: addDays(now, 2),
      type: "REGIME_SHIFT",
      probabilityScore: clampScore(60 + regime.confidence * 0.25),
      historicalAvgReturn,
      description: `Zmiana reżimu z ${prev.regime} na ${regime.regime} w ostatnich 24h.`,
    };
    return { ...base, aiNote: await aiWindowNote(base) };
  } catch {
    return null;
  }
}

export async function getAlphaWindows(ticker: string): Promise<AlphaWindow[]> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return [];
  const windows = await Promise.all([
    buildEarningsWindow(symbol),
    buildSeasonalWindow(symbol),
    buildSectorRotationWindow(symbol),
    buildRegimeShiftWindow(symbol),
  ]);
  return windows.filter((x): x is AlphaWindow => Boolean(x)).sort((a, b) => b.probabilityScore - a.probabilityScore);
}

async function buildAlphaSummary(windows: AlphaWindow[]): Promise<string> {
  if (windows.length === 0) return "Brak aktywnych okien alpha dla wskazanych tickerów.";
  const top = windows[0];
  const fallback = `Wykryto ${windows.length} okien alpha. Najmocniejsze: ${top?.ticker} (${top?.type}) z oceną ${top?.probabilityScore}/100.`;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const client = new Anthropic({ apiKey });
    const topLines = windows
      .slice(0, 5)
      .map((w) => `${w.ticker} ${w.type} score=${w.probabilityScore} avg=${w.historicalAvgReturn.toFixed(2)}%`)
      .join("; ");
    const prompt = `Podsumuj po polsku okna alpha dla rynku. Dane: ${topLines}. Napisz 2-3 zdania, wskaż top opportunity i jedno ryzyko.`;
    const msg = await client.messages.create({
      model,
      max_tokens: 180,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim().replace(/\s+/g, " ") : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function getMarketAlphaCalendar(tickers: string[]): Promise<MarketAlphaCalendar> {
  const uniqueTickers = [...new Set(tickers.map((x) => x.trim().toUpperCase()).filter(Boolean))];
  const all = await Promise.all(uniqueTickers.map((ticker) => getAlphaWindows(ticker)));
  const windows = all.flat().sort((a, b) => b.probabilityScore - a.probabilityScore);
  const topOpportunity = windows[0] ?? null;
  const aiSummary = await buildAlphaSummary(windows);
  return { windows, topOpportunity, aiSummary };
}

export async function getTopTickers(limit = 20): Promise<string[]> {
  const rows = await prisma.signal.findMany({
    where: { ticker: { not: "" } },
    select: { ticker: true },
    distinct: ["ticker"],
    orderBy: { created_at: "desc" },
    take: Math.max(1, Math.min(100, limit)),
  });
  return rows.map((x) => x.ticker.toUpperCase());
}

async function sendAlphaCalendarDiscordEmbed(windows: AlphaWindow[], aiSummary: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl || windows.length === 0) return;
  const top5 = windows.slice(0, 5);
  const lines = top5
    .map(
      (w, idx) =>
        `${idx + 1}. ${w.ticker} | ${w.type} | ${w.probabilityScore}/100 | avg ${w.historicalAvgReturn.toFixed(2)}%`,
    )
    .join("\n");
  const payload = {
    embeds: [
      {
        title: "🗓️ Alpha Calendar — Top 5 Windows",
        description: lines,
        color: 0x7c3aed,
        fields: [{ name: "AI Summary", value: aiSummary.slice(0, 1024), inline: false }],
        footer: { text: "Stock-AI Pro Alpha Calendar" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function persistAlphaWindows(windows: AlphaWindow[]): Promise<void> {
  if (windows.length === 0) return;
  await prisma.alphaWindow.createMany({
    data: windows.map((w) => ({
      ticker: w.ticker,
      windowStart: w.windowStart,
      windowEnd: w.windowEnd,
      type: w.type,
      probabilityScore: w.probabilityScore,
      historicalAvgReturn: w.historicalAvgReturn,
      description: w.description,
      aiNote: w.aiNote,
      createdAt: new Date(),
    })),
  });
}

export function registerAlphaCalendarJob(): { queue: Queue; worker: Worker } {
  const connection = getCacheRedis();
  const queue = new Queue(ALPHA_CALENDAR_QUEUE_NAME, {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  });
  const worker = new Worker(
    ALPHA_CALENDAR_QUEUE_NAME,
    async (job) => {
      if (job.name !== ALPHA_CALENDAR_JOB_NAME) return;
      const topTickers = await getTopTickers(20);
      const result = await getMarketAlphaCalendar(topTickers);
      await persistAlphaWindows(result.windows);
      await sendAlphaCalendarDiscordEmbed(result.windows, result.aiSummary);
    },
    { connection },
  );
  return { queue, worker };
}

export async function scheduleDailyAlphaCalendar(queue: Queue): Promise<void> {
  await queue.add(
    ALPHA_CALENDAR_JOB_NAME,
    {},
    {
      repeat: { pattern: "0 7 * * *", tz: "Etc/UTC" },
      jobId: "alpha-calendar-daily-7am-utc",
    },
  );
}
