import { Queue, Worker } from "bullmq";
import pino from "pino";
import { prisma } from "../db/index";
import { discordBot } from "../integrations/discord";
import { getCacheRedis } from "../redis";
import { ALERT_QUEUE_NAME } from "./scanSignals";

export const PROCESS_SIGNAL_QUEUE_NAME = "process-signal";
export const PROCESS_SIGNAL_DLQ_NAME = "process-signal-dlq";
const PROCESS_SIGNAL_JOB_NAME = "process:signal";

export interface ProcessSignalJobInput {
  signalId: string;
}

interface BriefInput {
  ticker: string;
  pattern_type: string;
  confidence: number;
  rsi: number;
  macd: number;
  volume_ratio: number;
  support_level: number;
  price_position: number;
  historical_count: number;
  win_rate: number;
  avg_return_10d: number;
  max_drawdown: number;
  recent_news: string[];
  market_sentiment: string;
  sector_trend: string;
  vix: number;
}

interface ScoreInput {
  technical: number;
  history: number;
  sentiment: number;
  fundamentals: number;
  macro: number;
}

interface NewsItem {
  title: string;
  timestamp: Date;
  sentiment?: string | null;
}

interface MacroContext {
  marketSentiment: string;
  sectorTrend: string;
  vix: number;
}

interface SentimentResult {
  score: number;
  label: string;
}

export interface ProcessSignalResult {
  signalId: string;
  alertsQueued: number;
  score: number;
}

export interface ProcessSignalDeps {
  db: typeof prisma;
  alertQueue: Pick<Queue, "add">;
  dlqQueue: Pick<Queue, "add">;
  idempotencyStore: Pick<ReturnType<typeof getCacheRedis>, "set" | "get" | "del">;
  fetchRecentNews: (ticker: string) => Promise<NewsItem[]>;
  classifySentiment: (input: { ticker: string; news: NewsItem[] }) => Promise<SentimentResult>;
  fetchMacroContext: (ticker: string) => Promise<MacroContext>;
  generateSignalBrief: (input: BriefInput) => Promise<{ pl: string; en: string }>;
  scoreSignal: (input: ScoreInput) => Promise<{ score: number; reasoning: string }>;
  getUsersWithMatchingCriteria: (input: {
    ticker: string;
    patternType: string;
    confidence: number;
    score: number;
  }) => Promise<Array<Record<string, unknown>>>;
}

export const processSignalLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "process_signal_job" },
});

function clampScore(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}

function computeTechnicalScore(technicalData: Record<string, unknown>, confidence: number): number {
  const rsi = Number(technicalData.rsi ?? 50);
  const macd = Number(technicalData.macd ?? 0);
  const volumeRatio = Number(technicalData.volume_ratio ?? 1);
  let score = confidence;
  if (rsi >= 40 && rsi <= 70) score += 8;
  if (macd > 0) score += 6;
  if (volumeRatio > 1.2) score += 6;
  return clampScore(score);
}

function computeHistoryScore(winRate: number | null, avgReturn10d: number | null, maxDrawdown: number | null): number {
  const win = Number(winRate ?? 50);
  const avgRet = Number(avgReturn10d ?? 0);
  const dd = Number(maxDrawdown ?? 10);
  return clampScore(win * 0.7 + (avgRet + 10) * 1.2 - dd * 0.6);
}

function computeMacroScore(m: MacroContext): number {
  const sentiment = m.marketSentiment.toLowerCase();
  const sector = m.sectorTrend.toLowerCase();
  let score = 50;
  if (sentiment.includes("bull")) score += 20;
  if (sentiment.includes("bear")) score -= 20;
  if (sector.includes("up")) score += 15;
  if (sector.includes("down")) score -= 15;
  score += Math.max(-15, Math.min(15, (20 - m.vix) * 1.2));
  return clampScore(score);
}

async function withRetry<T>(op: string, fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      processSignalLogger.warn({
        msg: "retryable_step_failed",
        op,
        attempt,
        err: error instanceof Error ? error.message : String(error),
      });
      if (attempt >= retries) break;
      const backoffMs = 250 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
}

async function defaultFetchRecentNews(ticker: string): Promise<NewsItem[]> {
  const from = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await prisma.news.findMany({
    where: { symbol: ticker.toUpperCase(), timestamp: { gte: from } },
    orderBy: { timestamp: "desc" },
    take: 20,
    select: { title: true, timestamp: true, sentiment: true },
  });
  return rows;
}

async function defaultClassifySentiment(input: { ticker: string; news: NewsItem[] }): Promise<SentimentResult> {
  const text = input.news.map((n) => `${n.title} ${n.sentiment ?? ""}`).join(" ").toLowerCase();
  if (!text) return { score: 50, label: "neutral" };
  const positive = ["beat", "growth", "strong", "upgrade", "buyback"];
  const negative = ["downgrade", "lawsuit", "miss", "weak", "cut"];
  let score = 50;
  for (const w of positive) if (text.includes(w)) score += 6;
  for (const w of negative) if (text.includes(w)) score -= 6;
  score = clampScore(score);
  return { score, label: score >= 60 ? "positive" : score <= 40 ? "negative" : "neutral" };
}

async function defaultFetchMacroContext(_ticker: string): Promise<MacroContext> {
  return {
    marketSentiment: process.env.MARKET_SENTIMENT ?? "neutral",
    sectorTrend: process.env.SECTOR_TREND ?? "sideways",
    vix: Number(process.env.VIX_LEVEL ?? 18),
  };
}

async function defaultGenerateSignalBrief(input: BriefInput): Promise<{ pl: string; en: string }> {
  const pl = `Sygnał ${input.pattern_type} dla ${input.ticker} (confidence ${input.confidence}). Kontekst news/sentyment: ${input.market_sentiment}.`;
  const en = `Signal ${input.pattern_type} for ${input.ticker} (confidence ${input.confidence}). News/sentiment context: ${input.market_sentiment}.`;
  return { pl, en };
}

async function defaultScoreSignal(input: ScoreInput): Promise<{ score: number; reasoning: string }> {
  const score = clampScore(
    input.technical * 0.3 +
      input.history * 0.3 +
      input.sentiment * 0.2 +
      input.fundamentals * 0.15 +
      input.macro * 0.05,
  );
  return {
    score,
    reasoning: `Score ${score} bo: technical ${input.technical}, history ${input.history}, sentiment ${input.sentiment}, fundamentals ${input.fundamentals}, macro ${input.macro}`,
  };
}

async function defaultGetUsersWithMatchingCriteria(_input: {
  ticker: string;
  patternType: string;
  confidence: number;
  score: number;
}): Promise<Array<Record<string, unknown>>> {
  const dbMaybe = prisma as unknown as {
    user?: {
      findMany?: (args?: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };
  if (!dbMaybe.user?.findMany) return [];
  try {
    return await dbMaybe.user.findMany({});
  } catch {
    return [];
  }
}

export async function runProcessSignalJob(
  input: ProcessSignalJobInput,
  depsInput?: Partial<ProcessSignalDeps>,
): Promise<ProcessSignalResult> {
  const redis = depsInput ? null : getCacheRedis();
  const idempotencyStore =
    depsInput?.idempotencyStore ??
    (depsInput
      ? ({
          get: async () => null,
          set: async () => "OK",
          del: async () => 1,
        } as Pick<ReturnType<typeof getCacheRedis>, "set" | "get" | "del">)
      : (redis ?? getCacheRedis()));
  const deps: ProcessSignalDeps = {
    db: depsInput?.db ?? prisma,
    alertQueue: depsInput?.alertQueue ?? new Queue(ALERT_QUEUE_NAME, { connection: redis ?? getCacheRedis() }),
    dlqQueue:
      depsInput?.dlqQueue ?? new Queue(PROCESS_SIGNAL_DLQ_NAME, { connection: redis ?? getCacheRedis() }),
    idempotencyStore,
    fetchRecentNews: depsInput?.fetchRecentNews ?? defaultFetchRecentNews,
    classifySentiment: depsInput?.classifySentiment ?? defaultClassifySentiment,
    fetchMacroContext: depsInput?.fetchMacroContext ?? defaultFetchMacroContext,
    generateSignalBrief: depsInput?.generateSignalBrief ?? defaultGenerateSignalBrief,
    scoreSignal: depsInput?.scoreSignal ?? defaultScoreSignal,
    getUsersWithMatchingCriteria: depsInput?.getUsersWithMatchingCriteria ?? defaultGetUsersWithMatchingCriteria,
  };

  if (!input.signalId?.trim()) {
    throw new Error("signalId is required");
  }

  const lockKey = `process-signal:lock:${input.signalId}`;
  const doneKey = `process-signal:done:${input.signalId}`;
  const alreadyDone = await deps.idempotencyStore.get(doneKey);
  if (alreadyDone) {
    const existing = await deps.db.signal.findUnique({ where: { id: input.signalId } });
    return {
      signalId: input.signalId,
      alertsQueued: 0,
      score: existing?.score ?? 0,
    };
  }
  const lock = await deps.idempotencyStore.set(lockKey, "1", "NX", "EX", 120);
  if (lock !== "OK") {
    const existing = await deps.db.signal.findUnique({ where: { id: input.signalId } });
    return {
      signalId: input.signalId,
      alertsQueued: 0,
      score: existing?.score ?? 0,
    };
  }

  let succeeded = false;
  return withRetry("process_signal_job", async () => {
    const signal = await deps.db.signal.findUnique({
      where: { id: input.signalId },
    });
    if (!signal) throw new Error(`Signal not found: ${input.signalId}`);

    const technicalData = (signal.technical_data ?? {}) as Record<string, unknown>;
    const news = await deps.fetchRecentNews(signal.ticker);
    const sentiment = await deps.classifySentiment({ ticker: signal.ticker, news });
    const macro = await deps.fetchMacroContext(signal.ticker);

    const brief = await deps.generateSignalBrief({
      ticker: signal.ticker,
      pattern_type: signal.pattern_type,
      confidence: signal.confidence,
      rsi: Number(technicalData.rsi ?? 50),
      macd: Number(technicalData.macd ?? 0),
      volume_ratio: Number(technicalData.volume_ratio ?? 1),
      support_level: Number(technicalData.support_level ?? 0),
      price_position: Number(technicalData.price_position ?? 0.5),
      historical_count: signal.historical_count ?? 0,
      win_rate: signal.win_rate ?? 0,
      avg_return_10d: signal.avg_return_10d ?? 0,
      max_drawdown: signal.max_drawdown ?? 0,
      recent_news: news.map((n) => n.title),
      market_sentiment: sentiment.label,
      sector_trend: macro.sectorTrend,
      vix: macro.vix,
    });

    const technical = computeTechnicalScore(technicalData, signal.confidence);
    const history = computeHistoryScore(signal.win_rate, signal.avg_return_10d, signal.max_drawdown);
    const sentimentScore = clampScore(sentiment.score);
    const fundamentals = 50;
    const macroScore = computeMacroScore(macro);

    const scored = await deps.scoreSignal({
      technical,
      history,
      sentiment: sentimentScore,
      fundamentals,
      macro: macroScore,
    });

    const updated = await deps.db.signal.update({
      where: { id: signal.id },
      data: {
        brief_pl: brief.pl,
        brief_en: brief.en,
        score: scored.score,
        scoring_reasoning: scored.reasoning,
      },
    });

    // Post to Discord
    if ((updated.score ?? 0) >= 70) {
      const channel = updated.exchange === "GPW" ? "signals_gpw" : "signals_us";
      await discordBot
        .sendSignal(channel, {
          ticker: updated.ticker,
          score: updated.score ?? 0,
          brief_pl: updated.brief_pl ?? "",
          pattern: updated.pattern_type,
          confidence: updated.confidence,
        })
        .catch((err) => processSignalLogger.error({ err }, "Discord send failed"));
    }

    const users = await deps.getUsersWithMatchingCriteria({
      ticker: updated.ticker,
      patternType: updated.pattern_type,
      confidence: updated.confidence,
      score: updated.score ?? 0,
    });
    for (const user of users) {
      await deps.alertQueue.add("alert:push", { signal: updated, user });

      const userId = (user as { id?: string })?.id;
      if (userId) {
        const lastTrade = await deps.db.virtualTrade.findFirst({
          where: { userId },
          orderBy: { executed_at: "desc" },
        });
        if (lastTrade) {
          await discordBot
            .sendPaperTradeUpdate(userId, {
              ticker: lastTrade.ticker,
              side: lastTrade.side,
              quantity: Number(lastTrade.quantity),
              price: Number(lastTrade.price),
              pnl_pct: lastTrade.pnl_pct ?? undefined,
            })
            .catch((err) => processSignalLogger.warn({ err }, "Paper trade Discord post failed"));
        }
      }
    }

    processSignalLogger.info({
      msg: "signal_processed",
      signalId: updated.id,
      ticker: updated.ticker,
      score: updated.score,
      alertsQueued: users.length,
    });

    const out = {
      signalId: updated.id,
      alertsQueued: users.length,
      score: updated.score ?? 0,
    };
    succeeded = true;
    return out;
  }).catch(async (error) => {
    await deps.dlqQueue.add("process:signal:failed", {
      input,
      err: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
    });
    processSignalLogger.error({
      msg: "process_signal_failed",
      signalId: input.signalId,
      err: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }).finally(async () => {
    if (succeeded) {
      await deps.idempotencyStore.set(doneKey, "1", "EX", 60 * 60 * 24);
    }
    await deps.idempotencyStore.del(lockKey);
  });
}

export function registerProcessSignal(
  _processSignalQueue?: Pick<Queue, "add">,
): { queue: Queue; worker: Worker; alertQueue: Queue; dlqQueue: Queue } {
  const queueConnection = getCacheRedis();
  const workerConnection = getCacheRedis();
  const queue = new Queue(PROCESS_SIGNAL_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  const alertQueue = new Queue(ALERT_QUEUE_NAME, { connection: queueConnection });
  const dlqQueue = new Queue(PROCESS_SIGNAL_DLQ_NAME, { connection: queueConnection });

  const worker = new Worker(
    PROCESS_SIGNAL_QUEUE_NAME,
    async (job) => {
      processSignalLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const result = await runProcessSignalJob(job.data as ProcessSignalJobInput, { alertQueue, dlqQueue });
      processSignalLogger.info({ msg: "end", jobId: job.id, ...result });
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    processSignalLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker, alertQueue, dlqQueue };
}

export async function enqueueProcessSignal(queue: Queue, signalId: string): Promise<void> {
  await queue.add(PROCESS_SIGNAL_JOB_NAME, { signalId });
}
