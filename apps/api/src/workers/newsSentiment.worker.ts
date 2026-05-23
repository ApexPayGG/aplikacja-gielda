import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { createRedisConnection } from "../redis";
import {
  fetchNewsSentimentProviderContext,
  generateNewsSentimentActs,
  resolveWarmCacheTickers,
} from "../modules/news-sentiment/newsSentiment.providers";
import {
  enqueueRefreshTickerIntel,
  getNewsSentimentQueue,
} from "../modules/news-sentiment/newsSentiment.queue";
import {
  NEWS_SENTIMENT_JOB_NAMES,
  NEWS_SENTIMENT_QUEUE_NAME,
  type InvalidateTickerIntelJobData,
  type NewsSentimentFullPayload,
  type RefreshTickerIntelJobData,
  type WarmCacheBatchJobData,
} from "../modules/news-sentiment/newsSentiment.types";
import {
  normalizeNewsSentimentTicker,
  resolveInvalidationTargets,
  smartNarrativeCacheService,
} from "../modules/news-sentiment/smartNarrativeCache.service";

async function processRefreshTickerIntel(data: RefreshTickerIntelJobData): Promise<{ ticker: string; cached: boolean }> {
  const ticker = normalizeNewsSentimentTicker(data.ticker);
  if (!ticker) return { ticker: "", cached: false };

  const lockAcquired = await smartNarrativeCacheService.acquireGenerationLock(ticker);
  if (!lockAcquired && !data.force) {
    return { ticker, cached: false };
  }

  const previousMeta = await smartNarrativeCacheService.getMeta(ticker);
  const context = await fetchNewsSentimentProviderContext(ticker, previousMeta?.lastPrice ?? null);

  await smartNarrativeCacheService.evaluateAndInvalidateFromSignals(ticker, {
    intradayChangePct: context.signals.intradayChangePct,
    earningsEventDetected: context.signals.earningsEventDetected,
    ma200Break: context.signals.ma200Break,
  });

  const acts = await generateNewsSentimentActs(context);
  await Promise.all([
    smartNarrativeCacheService.setAct(ticker, "act1", acts.act1),
    smartNarrativeCacheService.setAct(ticker, "act2", acts.act2),
    smartNarrativeCacheService.setAct(ticker, "act3", acts.act3),
  ]);

  const invalidationState = {
    act2Invalidated: false,
    act3Invalidated: false,
    lastInvalidationReason: null,
    lastInvalidatedAt: null,
    intradayChangePct: context.signals.intradayChangePct,
    ma200Break: context.signals.ma200Break,
    earningsEventDetected: context.signals.earningsEventDetected,
  };

  await smartNarrativeCacheService.setMeta(ticker, {
    ticker,
    lastPrice: context.signals.currentPrice,
    lastOpen: context.quote?.open ?? null,
    ma200: context.signals.ma200,
    ma200Side:
      context.signals.currentPrice != null && context.signals.ma200 != null
        ? context.signals.currentPrice > context.signals.ma200
          ? "above"
          : "below"
        : "unknown",
    updatedAt: new Date().toISOString(),
    invalidationState,
  });

  const fullPayload: NewsSentimentFullPayload = {
    ticker,
    generatedAt: new Date().toISOString(),
    providerStatus: context.providerStatus,
    acts,
    invalidationState,
  };
  await smartNarrativeCacheService.setFull(ticker, fullPayload);

  return { ticker, cached: true };
}

async function processInvalidateTickerIntel(data: InvalidateTickerIntelJobData): Promise<{ ticker: string }> {
  const ticker = normalizeNewsSentimentTicker(data.ticker);
  if (!ticker) return { ticker: "" };

  const targets = resolveInvalidationTargets(data.reason);
  await smartNarrativeCacheService.invalidateActs(ticker, targets, data.reason);
  return { ticker };
}

async function processWarmCacheBatch(data: WarmCacheBatchJobData): Promise<{ enqueued: number }> {
  const tickers = resolveWarmCacheTickers(data.tickers);
  let enqueued = 0;
  for (const ticker of tickers) {
    await enqueueRefreshTickerIntel(ticker);
    enqueued += 1;
  }
  return { enqueued };
}

async function dispatchNewsSentimentJob(job: Job): Promise<unknown> {
  switch (job.name) {
    case NEWS_SENTIMENT_JOB_NAMES.REFRESH_TICKER_INTEL:
      return processRefreshTickerIntel(job.data as RefreshTickerIntelJobData);
    case NEWS_SENTIMENT_JOB_NAMES.INVALIDATE_TICKER_INTEL:
      return processInvalidateTickerIntel(job.data as InvalidateTickerIntelJobData);
    case NEWS_SENTIMENT_JOB_NAMES.WARM_CACHE_BATCH:
      return processWarmCacheBatch(job.data as WarmCacheBatchJobData);
    default:
      throw new Error(`Unknown news sentiment job: ${job.name}`);
  }
}

export const newsSentimentWorker = new Worker(
  NEWS_SENTIMENT_QUEUE_NAME,
  async (job) => dispatchNewsSentimentJob(job),
  {
    connection: createRedisConnection() as unknown as ConnectionOptions,
    concurrency: 3,
  },
);

newsSentimentWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "news_sentiment_worker_job_failed",
      jobId: job?.id,
      jobName: job?.name,
      ticker: (job?.data as RefreshTickerIntelJobData | undefined)?.ticker,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
});

newsSentimentWorker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "news_sentiment_worker_job_completed",
      jobId: job.id,
      jobName: job.name,
    }),
  );
});

void getNewsSentimentQueue();
