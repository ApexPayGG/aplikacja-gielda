import Anthropic from "@anthropic-ai/sdk";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { prisma } from "../../db/index";
import { enqueueDiscordSignalAlert } from "../../queues/discordSignalAlerts";
import { getCacheRedis } from "../../redis";
import { backfillDividendsFromEodhd } from "../../services/dividendDataService";

export type DividendData = {
  ticker: string;
  name: string;
  dividendYield: number;
  payoutRatio: number;
  yearsOfGrowth: number;
  exDate: string;
  amount: number;
  currency: string;
  healthScore: number;
  healthLabel: "SAFE" | "WATCH" | "RISKY";
  trend: "GROWING" | "STABLE" | "DECLINING";
  aiBreef: string;
};

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", base: { scope: "dividend_module" } });
const DIVIDEND_ALERTS_QUEUE_NAME = "dividend-module-alerts";
const DIVIDEND_ALERTS_JOB_NAME = "dividendAlerts";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function consecutiveGrowthYears(historiesAsc: Array<{ year: number; growthYoY: number | null }>): number {
  if (historiesAsc.length === 0) return 0;
  let streak = 0;
  for (let i = historiesAsc.length - 1; i >= 0; i -= 1) {
    const row = historiesAsc[i];
    if ((row?.growthYoY ?? 0) > 0) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function resolveTrend(historiesAsc: Array<{ totalAmount: number }>): "GROWING" | "STABLE" | "DECLINING" {
  if (historiesAsc.length < 3) return "STABLE";
  const a = historiesAsc[historiesAsc.length - 3]?.totalAmount ?? 0;
  const b = historiesAsc[historiesAsc.length - 2]?.totalAmount ?? 0;
  const c = historiesAsc[historiesAsc.length - 1]?.totalAmount ?? 0;
  if (c > b && b >= a) return "GROWING";
  if (c < b && b <= a) return "DECLINING";
  return "STABLE";
}

function healthLabel(score: number): "SAFE" | "WATCH" | "RISKY" {
  if (score >= 80) return "SAFE";
  if (score >= 50) return "WATCH";
  return "RISKY";
}

async function generateAiBreef(input: {
  ticker: string;
  dividendYield: number;
  payoutRatio: number;
  yearsOfGrowth: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
}): Promise<string> {
  const fallback = `Dywidenda ${input.ticker}: yield ${input.dividendYield.toFixed(2)}%, payout ${input.payoutRatio.toFixed(1)}%, lata wzrostu ${input.yearsOfGrowth}, trend ${input.trend}. Oceń jako część strategii i monitoruj stabilność kolejnych wypłat.`;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const prompt = `Oceń bezpieczeństwo dywidendy ${input.ticker}. Dane: yield ${input.dividendYield.toFixed(2)}%, payout ${input.payoutRatio.toFixed(1)}%, lata wzrostu: ${input.yearsOfGrowth}, trend: ${input.trend}. Max 2 zdania po polsku.`;
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

async function loadDividendHealthContext(symbol: string) {
  return Promise.all([
    prisma.company.findUnique({
      where: { symbol },
      select: { name: true },
    }),
    prisma.dividend.findFirst({
      where: { symbol },
      orderBy: { exDate: "desc" },
      select: { symbol: true, exDate: true, amount: true, currency: true, yield: true },
    }),
    prisma.dividendHistory.findMany({
      where: { symbol },
      orderBy: { year: "asc" },
      select: { year: true, growthYoY: true, totalAmount: true },
    }),
    prisma.dividendSustainabilityScore.findUnique({
      where: { symbol },
      select: { payoutRatio: true },
    }),
  ] as const);
}

export async function getDividendHealth(ticker: string): Promise<DividendData> {
  const symbol = ticker.trim().toUpperCase();
  let [company, latestDividend, histories, sustainability] = await loadDividendHealthContext(symbol);

  if (!latestDividend) {
    logger.info({ msg: "dividend_eodhd_backfill_start", symbol });
    await backfillDividendsFromEodhd(symbol);
    [company, latestDividend, histories, sustainability] = await loadDividendHealthContext(symbol);
    if (!latestDividend) {
      throw new Error(`Dividend data not found for ${symbol}`);
    }
  }

  const years = consecutiveGrowthYears(histories);
  const trend = resolveTrend(histories);
  const dividendYield = Number(latestDividend.yield ?? 0);
  const payoutRatio = Number(sustainability?.payoutRatio ?? 0);
  const exDate = latestDividend.exDate;
  const monthsSinceLastPayment = (Date.now() - exDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

  let score = 0;
  if (payoutRatio < 60) score += 20;
  if (years >= 5) score += 20;
  if (trend === "GROWING") score += 20;
  if (dividendYield >= 2 && dividendYield <= 10) score += 20;
  if (monthsSinceLastPayment <= 12) score += 20;
  score = clampScore(score);

  const aiBreef = await generateAiBreef({
    ticker: symbol,
    dividendYield,
    payoutRatio,
    yearsOfGrowth: years,
    trend,
  });

  return {
    ticker: symbol,
    name: company?.name ?? symbol,
    dividendYield,
    payoutRatio,
    yearsOfGrowth: years,
    exDate: latestDividend.exDate.toISOString(),
    amount: latestDividend.amount,
    currency: latestDividend.currency,
    healthScore: score,
    healthLabel: healthLabel(score),
    trend,
    aiBreef,
  };
}

export async function getDividendScreener(filters: {
  minYield?: number;
  maxYield?: number;
  minYears?: number;
  minHealth?: number;
  trend?: "GROWING" | "STABLE" | "DECLINING";
}): Promise<DividendData[]> {
  const dividends = await prisma.dividend.findMany({
    where: {
      ...(filters.minYield !== undefined || filters.maxYield !== undefined
        ? {
            yield: {
              ...(filters.minYield !== undefined ? { gte: filters.minYield } : {}),
              ...(filters.maxYield !== undefined ? { lte: filters.maxYield } : {}),
            },
          }
        : {}),
    },
    orderBy: { exDate: "desc" },
    select: { symbol: true },
  });

  const symbols = [...new Set(dividends.map((d) => d.symbol))];
  const rows = await Promise.all(symbols.map((symbol) => getDividendHealth(symbol)));
  const filtered = rows.filter((row) => {
    if (filters.minYears !== undefined && row.yearsOfGrowth < filters.minYears) return false;
    if (filters.minHealth !== undefined && row.healthScore < filters.minHealth) return false;
    if (filters.trend && row.trend !== filters.trend) return false;
    return true;
  });
  return filtered.sort((a, b) => b.healthScore - a.healthScore);
}

export async function checkExDateAlerts(): Promise<void> {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = await prisma.dividend.findMany({
    where: { exDate: { gte: now, lte: end } },
    orderBy: { exDate: "asc" },
    select: { symbol: true, exDate: true, amount: true, currency: true },
  });

  for (const row of upcoming) {
    const days = Math.max(0, Math.ceil((row.exDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const brief = `📅 Ex-Date Alert: ${row.symbol} — za ${days} dni (${row.exDate.toISOString().slice(0, 10)}), dywidenda: ${row.amount} ${row.currency}`;
    await enqueueDiscordSignalAlert({
      ticker: row.symbol,
      signal: "dividend_ex_date",
      score: 80,
      brief,
      setup: "Dividend Ex-Date",
      logicalChannel: "dividend",
    });
  }
}

export function registerDividendAlertsJob(): { queue: Queue; worker: Worker } {
  const connection = getCacheRedis();
  const queue = new Queue(DIVIDEND_ALERTS_QUEUE_NAME, {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 4000 } },
  });
  const worker = new Worker(
    DIVIDEND_ALERTS_QUEUE_NAME,
    async (job) => {
      if (job.name !== DIVIDEND_ALERTS_JOB_NAME) return;
      await checkExDateAlerts();
    },
    { connection },
  );
  worker.on("failed", (job, err) => {
    logger.error({
      msg: "dividend_module_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });
  return { queue, worker };
}

export async function scheduleDailyDividendAlerts(queue: Queue): Promise<void> {
  await queue.add(
    DIVIDEND_ALERTS_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 8 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-dividend-alerts-8am-utc",
    },
  );
}
