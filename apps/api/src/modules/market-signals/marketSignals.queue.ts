import { Queue, type ConnectionOptions, type Job } from "bullmq";
import { createRedisConnection } from "../../redis";
import {
  InvalidMarketSignalProviderError,
  parseMarketSignalProvider,
  type MarketSignalIngestionService,
} from "./marketSignals.ingestion";
import {
  fetchProviderPayload,
  shouldIngestFetchedPayload,
} from "./marketSignals.fetchers";
import type { MarketSignalIngestionResult, MarketSignalProvider } from "./marketSignals.types";

export const MARKET_SIGNALS_QUEUE_NAME = "market-signals-ingestion-queue";

export const MARKET_SIGNALS_JOB_NAMES = {
  INGEST_PROVIDER_PAYLOAD: "ingest-provider-payload",
  FETCH_PROVIDER_AND_INGEST: "fetch-provider-and-ingest",
  SCHEDULE_MARKET_SIGNALS_BATCH: "schedule-market-signals-batch",
} as const;

export type IngestProviderPayloadJobData = {
  provider: MarketSignalProvider;
  payload: unknown;
  requestedByUserId?: string;
  reason?: string;
};

export type FetchProviderAndIngestJobData = {
  provider: MarketSignalProvider;
  ticker: string;
  reason?: string;
};

export type ScheduleMarketSignalsBatchJobData = Record<string, never>;

export type MarketSignalWorkerJobData =
  | IngestProviderPayloadJobData
  | FetchProviderAndIngestJobData
  | ScheduleMarketSignalsBatchJobData;

export type MarketSignalEnqueueResult = {
  queued: true;
  jobId: string;
  provider: MarketSignalProvider;
};

export type MarketSignalsQueueAddInput = {
  provider: MarketSignalProvider | string;
  payload: unknown;
  requestedByUserId?: string;
  reason?: string;
};

type QueueAddResult = {
  id?: string | null;
};

export type MarketSignalsQueueDeps = {
  queue?: {
    add: (
      name: string,
      data: MarketSignalWorkerJobData,
      options: { jobId: string },
    ) => Promise<QueueAddResult>;
  };
  now?: () => number;
};

let queueInstance: Queue | undefined;

const MARKET_SIGNALS_DEFAULT_JOB_OPTIONS = {
  removeOnComplete: 200,
  removeOnFail: 500,
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 3000 },
};

function getQueueConnection(): ConnectionOptions {
  return createRedisConnection() as unknown as ConnectionOptions;
}

export function getMarketSignalsQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(MARKET_SIGNALS_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: MARKET_SIGNALS_DEFAULT_JOB_OPTIONS,
    });
  }
  return queueInstance;
}

export function buildMarketSignalsJobId(provider: MarketSignalProvider, now = Date.now()): string {
  return `market-signals__${provider}__${now}`;
}

export function buildMarketSignalsFetchJobId(
  provider: MarketSignalProvider,
  ticker: string,
  now = Date.now(),
): string {
  return `market-signals__fetch__${provider}__${ticker}__${now}`;
}

export async function enqueueProviderPayload(
  input: MarketSignalsQueueAddInput,
  deps?: MarketSignalsQueueDeps,
): Promise<MarketSignalEnqueueResult> {
  const provider = parseMarketSignalProvider(input.provider);
  if (!provider) {
    throw new InvalidMarketSignalProviderError(input.provider);
  }

  const jobId = buildMarketSignalsJobId(provider, deps?.now?.() ?? Date.now());
  const data: IngestProviderPayloadJobData = {
    provider,
    payload: input.payload,
    requestedByUserId: input.requestedByUserId,
    reason: input.reason?.trim() || undefined,
  };

  const queue = deps?.queue ?? getMarketSignalsQueue();
  const job = await queue.add(MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD, data, { jobId });

  return {
    queued: true,
    jobId: job.id ?? jobId,
    provider,
  };
}

export async function enqueueFetchProviderAndIngest(
  input: {
    provider: MarketSignalProvider | string;
    ticker: string;
    reason?: string;
  },
  deps?: MarketSignalsQueueDeps & {
    buildJobId?: typeof buildMarketSignalsFetchJobId;
  },
): Promise<MarketSignalEnqueueResult & { ticker: string }> {
  const provider = parseMarketSignalProvider(input.provider);
  if (!provider) {
    throw new InvalidMarketSignalProviderError(input.provider);
  }

  const ticker = input.ticker.trim().toUpperCase();
  const buildJobId = deps?.buildJobId ?? buildMarketSignalsFetchJobId;
  const jobId = buildJobId(provider, ticker, deps?.now?.() ?? Date.now());
  const data: FetchProviderAndIngestJobData = {
    provider,
    ticker,
    reason: input.reason?.trim() || undefined,
  };

  const queue = deps?.queue ?? getMarketSignalsQueue();
  const job = await queue.add(MARKET_SIGNALS_JOB_NAMES.FETCH_PROVIDER_AND_INGEST, data, { jobId });

  return {
    queued: true,
    jobId: job.id ?? jobId,
    provider,
    ticker,
  };
}

export async function closeMarketSignalsQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = undefined;
  }
}

export type MarketSignalsWorkerDeps = {
  ingestionService: MarketSignalIngestionService;
  fetchProviderPayload?: typeof fetchProviderPayload;
  runScheduledBatch?: () => Promise<{ enqueued: number }>;
};

export type FetchProviderAndIngestWorkerResult = MarketSignalIngestionResult & {
  fetchOk: boolean;
  errorCode?: string;
  skippedIngest?: boolean;
};

async function processFetchProviderAndIngestJob(
  data: FetchProviderAndIngestJobData,
  deps: MarketSignalsWorkerDeps,
): Promise<FetchProviderAndIngestWorkerResult> {
  const provider = parseMarketSignalProvider(data.provider);
  if (!provider) {
    throw new InvalidMarketSignalProviderError(data.provider);
  }

  const fetchFn = deps.fetchProviderPayload ?? fetchProviderPayload;
  const fetchResult = await fetchFn(provider, data.ticker);

  if (!shouldIngestFetchedPayload(fetchResult)) {
    return {
      provider,
      parsedCount: 0,
      savedCount: 0,
      rejectedCount: 0,
      signals: [],
      fetchOk: fetchResult.ok,
      errorCode: fetchResult.errorCode,
      skippedIngest: true,
    };
  }

  const ingestionResult = await deps.ingestionService.ingestProviderPayload(provider, fetchResult.payload);
  return {
    ...ingestionResult,
    fetchOk: fetchResult.ok,
    errorCode: fetchResult.errorCode,
  };
}

export function createMarketSignalsWorkerHandler(
  deps: MarketSignalsWorkerDeps,
): (job: Job<MarketSignalWorkerJobData>) => Promise<unknown> {
  return async (job) => {
    switch (job.name) {
      case MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD: {
        const data = job.data as IngestProviderPayloadJobData;
        const provider = parseMarketSignalProvider(data.provider);
        if (!provider) {
          throw new InvalidMarketSignalProviderError(data.provider);
        }
        return deps.ingestionService.ingestProviderPayload(provider, data.payload);
      }
      case MARKET_SIGNALS_JOB_NAMES.FETCH_PROVIDER_AND_INGEST:
        return processFetchProviderAndIngestJob(job.data as FetchProviderAndIngestJobData, deps);
      case MARKET_SIGNALS_JOB_NAMES.SCHEDULE_MARKET_SIGNALS_BATCH:
        if (!deps.runScheduledBatch) {
          throw new Error("Market signals scheduler batch handler is not configured");
        }
        return deps.runScheduledBatch();
      default:
        throw new Error(`Unknown market signals job: ${job.name}`);
    }
  };
}
