import { Worker, type ConnectionOptions } from "bullmq";
import { createRedisConnection } from "../redis";
import { createMarketSignalIngestionService } from "../modules/market-signals/marketSignals.ingestion";
import {
  createMarketSignalsWorkerHandler,
  getMarketSignalsQueue,
  MARKET_SIGNALS_QUEUE_NAME,
  type IngestProviderPayloadJobData,
} from "../modules/market-signals/marketSignals.queue";
import type { MarketSignalIngestionResult } from "../modules/market-signals/marketSignals.types";
import { marketSignalsService } from "../modules/market-signals/marketSignals.service";

function resolveMarketSignalsWorkerConcurrency(): number {
  const raw = process.env.MARKET_SIGNALS_WORKER_CONCURRENCY;
  if (raw === undefined || raw.trim() === "") return 2;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

const defaultIngestionService = createMarketSignalIngestionService({
  marketSignalService: marketSignalsService,
});

export { createMarketSignalsWorkerHandler } from "../modules/market-signals/marketSignals.queue";
export type { MarketSignalsWorkerDeps } from "../modules/market-signals/marketSignals.queue";

export const marketSignalsWorker = new Worker(
  MARKET_SIGNALS_QUEUE_NAME,
  createMarketSignalsWorkerHandler({ ingestionService: defaultIngestionService }),
  {
    connection: createRedisConnection() as unknown as ConnectionOptions,
    concurrency: resolveMarketSignalsWorkerConcurrency(),
  },
);

marketSignalsWorker.on("ready", () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "market_signals_worker_ready",
      queue: MARKET_SIGNALS_QUEUE_NAME,
      concurrency: resolveMarketSignalsWorkerConcurrency(),
    }),
  );
});

marketSignalsWorker.on("completed", (job, result) => {
  const ingestionResult = result as MarketSignalIngestionResult | undefined;
  console.log(
    JSON.stringify({
      level: "info",
      event: "market_signals_worker_job_completed",
      jobId: job.id,
      jobName: job.name,
      provider: ingestionResult?.provider ?? (job.data as IngestProviderPayloadJobData).provider,
      parsedCount: ingestionResult?.parsedCount,
      savedCount: ingestionResult?.savedCount,
      rejectedCount: ingestionResult?.rejectedCount,
    }),
  );
});

marketSignalsWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "market_signals_worker_job_failed",
      jobId: job?.id,
      jobName: job?.name,
      provider: (job?.data as IngestProviderPayloadJobData | undefined)?.provider,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
});

void getMarketSignalsQueue();
