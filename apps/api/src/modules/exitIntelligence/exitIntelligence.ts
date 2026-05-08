import Anthropic from "@anthropic-ai/sdk";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { prisma } from "../../db/index";
import { getMarketRegime } from "../../marketRegime";
import { enqueueDiscordSignalAlert } from "../../queues/discordSignalAlerts";
import { getCacheRedis } from "../../redis";

export type ExitSignal = {
  tradeId: string;
  ticker: string;
  action: "HOLD" | "EXIT_NOW" | "TIGHTEN_SL" | "SCALE_OUT";
  reason: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  currentPnlPct: number;
  aiAdvice: string;
};

type DbLike = {
  paperTrade: {
    findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  };
  quote: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
  exitSignal: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
};

const db = prisma as unknown as DbLike;
const logger = pino({ level: process.env.LOG_LEVEL ?? "info", base: { scope: "exit_intelligence" } });
const EXIT_MONITOR_QUEUE_NAME = "exit-monitor";
const EXIT_MONITOR_JOB_NAME = "exitMonitor";

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pnlPct(direction: "LONG" | "SHORT", entry: number, current: number): number {
  if (entry <= 0) return 0;
  const pct = direction === "LONG" ? ((current - entry) / entry) * 100 : ((entry - current) / entry) * 100;
  return Number(pct.toFixed(4));
}

function urgencyScore(u: ExitSignal["urgency"]): number {
  if (u === "CRITICAL") return 95;
  if (u === "HIGH") return 85;
  if (u === "MEDIUM") return 75;
  return 55;
}

async function aiAdvice(input: {
  ticker: string;
  direction: "LONG" | "SHORT";
  pnlPct: number;
  regime: string;
  hours: number;
  fallbackReason: string;
}): Promise<string> {
  const fallback = `${input.fallbackReason}. PnL ${input.pnlPct.toFixed(2)}%, reżim ${input.regime}, czas ${input.hours.toFixed(1)}h.`;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const prompt = `Trader ma otwartą pozycję ${input.ticker} ${input.direction}. PnL: ${input.pnlPct.toFixed(2)}%, reżim: ${input.regime}, czas: ${input.hours.toFixed(1)}h. Podaj konkretną radę co zrobić. Max 2 zdania po polsku.`;
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

export async function analyzeExit(tradeId: string): Promise<ExitSignal> {
  const trade = await db.paperTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error(`Paper trade not found: ${tradeId}`);
  if (String(trade.status) !== "OPEN") throw new Error(`Trade ${tradeId} is not OPEN`);

  const ticker = String(trade.ticker).toUpperCase();
  const direction = String(trade.direction) as "LONG" | "SHORT";
  const entryPrice = asNumber(trade.entryPrice);
  const entryAt = new Date(String(trade.entryAt));

  const [quote, regime] = await Promise.all([
    db.quote.findFirst({ where: { symbol: ticker }, orderBy: { timestamp: "desc" } }),
    getMarketRegime(ticker),
  ]);
  const currentPrice = quote ? asNumber(quote.close, entryPrice) : entryPrice;
  const currentPnlPct = pnlPct(direction, entryPrice, currentPrice);
  const hours = Math.max(0, (Date.now() - entryAt.getTime()) / (1000 * 60 * 60));

  let action: ExitSignal["action"] = "HOLD";
  let urgency: ExitSignal["urgency"] = "LOW";
  let reason = "Pozycja rozwija się zgodnie z oczekiwaniami.";

  if (currentPnlPct <= -7) {
    action = "EXIT_NOW";
    urgency = "CRITICAL";
    reason = "Stop loss -7% przekroczony";
  } else if (currentPnlPct >= 10) {
    action = "SCALE_OUT";
    urgency = "MEDIUM";
    reason = "Cel +10% osiągnięty — rozważ realizację części";
  } else if (currentPnlPct >= 5 && regime.regime === "RISK_OFF") {
    action = "TIGHTEN_SL";
    urgency = "HIGH";
    reason = "Reżim RISK_OFF — zabezpiecz zysk";
  } else if (hours > 72 && currentPnlPct >= -2 && currentPnlPct <= 2) {
    action = "EXIT_NOW";
    urgency = "MEDIUM";
    reason = "Trade stoi w miejscu 72h — uwolnij kapitał";
  }

  const advice = await aiAdvice({
    ticker,
    direction,
    pnlPct: currentPnlPct,
    regime: regime.regime,
    hours,
    fallbackReason: reason,
  });

  return {
    tradeId,
    ticker,
    action,
    reason,
    urgency,
    currentPnlPct,
    aiAdvice: advice,
  };
}

export function registerExitMonitorJob(): { queue: Queue; worker: Worker } {
  const connection = getCacheRedis();
  const queue = new Queue(EXIT_MONITOR_QUEUE_NAME, {
    connection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 4000 } },
  });
  const worker = new Worker(
    EXIT_MONITOR_QUEUE_NAME,
    async (job) => {
      if (job.name !== EXIT_MONITOR_JOB_NAME) return;
      const openTrades = await db.paperTrade.findMany({
        where: { status: "OPEN" },
        orderBy: { entryAt: "asc" },
      });
      for (const trade of openTrades) {
        const signal = await analyzeExit(String(trade.id));
        if (signal.action !== "HOLD") {
          await enqueueDiscordSignalAlert({
            ticker: signal.ticker,
            signal: "exit_intelligence",
            score: urgencyScore(signal.urgency),
            brief: `${signal.urgency}: ${signal.ticker} — ${signal.action}\n${signal.reason}\n${signal.aiAdvice}`,
            setup: "Exit Intelligence",
            logicalChannel: "paper_exit",
          });
        }
        await db.exitSignal.create({
          data: {
            tradeId: signal.tradeId,
            ticker: signal.ticker,
            action: signal.action,
            urgency: signal.urgency,
            pnlPct: signal.currentPnlPct,
            reason: signal.reason,
            createdAt: new Date(),
          },
        });
      }
    },
    { connection },
  );
  worker.on("failed", (job, err) => {
    logger.error({
      msg: "exit_monitor_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });
  return { queue, worker };
}

export async function scheduleExitMonitor(queue: Queue): Promise<void> {
  await queue.add(
    EXIT_MONITOR_JOB_NAME,
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: "exit-monitor-every-15-min",
    },
  );
}
