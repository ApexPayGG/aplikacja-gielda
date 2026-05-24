import { Queue, type ConnectionOptions, type Job } from "bullmq";
import { createRedisConnection } from "../../redis";
import {
  InvalidMarketSignalProviderError,
  parseMarketSignalProvider,
  type MarketSignalIngestionService,
} from "./marketSignals.ingestion";
import type { MarketSignalIngestionResult, MarketSignalProvider } from "./marketSignals.types";

export const MARKET_SIGNALS_QUEUE_NAME = "market-signals-ingestion-queue";

export const MARKET_SIGNALS_JOB_NAMES = {
  INGEST_PROVIDER_PAYLOAD: "ingest-provider-payload",
} as const;

export type IngestProviderPayloadJobData = {
  provider: MarketSignalProvider;
  payload: unknown;
  requestedByUserId?: string;
  reason?: string;
};

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
  queue: {
    add: (
      name: string,
      data: IngestProviderPayloadJobData,
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

export async function closeMarketSignalsQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = undefined;
  }
}

export type MarketSignalsWorkerDeps = {
  ingestionService: MarketSignalIngestionService;
};

export function createMarketSignalsWorkerHandler(
  deps: MarketSignalsWorkerDeps,
): (job: Job<IngestProviderPayloadJobData>) => Promise<MarketSignalIngestionResult> {
  return async (job) => {
    if (job.name !== MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD) {
      throw new Error(`Unknown market signals job: ${job.name}`);
    }

    const data = job.data;
    const provider = parseMarketSignalProvider(data.provider);
    if (!provider) {
      throw new InvalidMarketSignalProviderError(data.provider);
    }

    return deps.ingestionService.ingestProviderPayload(provider, data.payload);
  };
}
