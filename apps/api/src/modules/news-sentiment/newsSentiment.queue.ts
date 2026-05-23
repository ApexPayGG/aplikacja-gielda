import { Queue, type ConnectionOptions } from "bullmq";
import { createRedisConnection } from "../../redis";
import {
  NEWS_SENTIMENT_JOB_NAMES,
  NEWS_SENTIMENT_QUEUE_NAME,
  type InvalidateTickerIntelJobData,
  type RefreshTickerIntelJobData,
  type WarmCacheBatchJobData,
} from "./newsSentiment.types";
import { resolveWarmCacheTickers } from "./newsSentiment.providers";
import { normalizeNewsSentimentTicker } from "./smartNarrativeCache.service";

let queueInstance: Queue | undefined;

function getQueueConnection(): ConnectionOptions {
  return createRedisConnection() as unknown as ConnectionOptions;
}

export function getNewsSentimentQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(NEWS_SENTIMENT_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
      },
    });
  }
  return queueInstance;
}

export async function enqueueRefreshTickerIntel(
  ticker: string,
  options?: { force?: boolean },
): Promise<string | undefined> {
  const normalized = normalizeNewsSentimentTicker(ticker);
  if (!normalized) return undefined;
  const data: RefreshTickerIntelJobData = { ticker: normalized, force: options?.force ?? false };
  const job = await getNewsSentimentQueue().add(NEWS_SENTIMENT_JOB_NAMES.REFRESH_TICKER_INTEL, data, {
    jobId: `refresh:${normalized}:${Date.now()}`,
  });
  return job.id ?? undefined;
}

export async function enqueueInvalidateTickerIntel(ticker: string, reason: string): Promise<string | undefined> {
  const normalized = normalizeNewsSentimentTicker(ticker);
  if (!normalized) return undefined;
  const data: InvalidateTickerIntelJobData = { ticker: normalized, reason };
  const job = await getNewsSentimentQueue().add(NEWS_SENTIMENT_JOB_NAMES.INVALIDATE_TICKER_INTEL, data, {
    jobId: `invalidate:${normalized}:${Date.now()}`,
  });
  return job.id ?? undefined;
}

export async function enqueueNewsSentimentWarmBatch(tickers?: string[]): Promise<string | undefined> {
  const data: WarmCacheBatchJobData = { tickers: resolveWarmCacheTickers(tickers) };
  const job = await getNewsSentimentQueue().add(NEWS_SENTIMENT_JOB_NAMES.WARM_CACHE_BATCH, data, {
    jobId: `warm-batch:${Date.now()}`,
  });
  return job.id ?? undefined;
}

export async function closeNewsSentimentQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = undefined;
  }
}
