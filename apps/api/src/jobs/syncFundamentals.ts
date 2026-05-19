/**
 * BullMQ: daily fundamentals sync @ 03:00 UTC (po jobie dywidend 01:00).
 */
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { loadTopDividendSymbols } from "../services/dividendDataService";
import { syncFundamentalsForSymbols } from "../services/fundamentalDataService";
import { runIngestJob, STANDARD_INGEST_JOB_OPTIONS, WEEKDAY_EOD_CRON } from "./schedulerConfig";

export const FUNDAMENTAL_QUEUE_NAME = "fundamental-sync";

export const fundamentalJobLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "fundamental_job" },
});

export function registerFundamentalSync(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(FUNDAMENTAL_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { ...STANDARD_INGEST_JOB_OPTIONS },
  });

  const worker = new Worker(
    FUNDAMENTAL_QUEUE_NAME,
    async (job) => {
      return runIngestJob(
        { queue: FUNDAMENTAL_QUEUE_NAME, provider: "eodhd", jobId: job.id, jobName: job.name },
        async () => {
          fundamentalJobLogger.info({ msg: "start", jobId: job.id, name: job.name, provider: "eodhd" });
          const symbols = await loadTopDividendSymbols(100);
          const out = await syncFundamentalsForSymbols(symbols);
          fundamentalJobLogger.info({
            msg: "end",
            jobId: job.id,
            provider: "eodhd",
            symbolsTotal: out.symbolsTotal,
            symbolsOk: out.symbolsOk,
            symbolsFailed: out.symbolsFailed,
            rowsUpserted: out.rowsUpserted,
          });
          if (out.errors.length > 0) {
            fundamentalJobLogger.warn({
              msg: "partial_errors",
              provider: "eodhd",
              count: out.errors.length,
              sample: out.errors.slice(0, 5),
            });
          }
          if (out.symbolsFailed > 0 && out.symbolsOk === 0) {
            throw new Error(`EODHD fundamentals sync failed for all ${out.symbolsTotal} symbols`);
          }
          return out;
        },
        { respectMarketHours: false },
      );
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    fundamentalJobLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker };
}

/** Codziennie 03:00 UTC */
export async function scheduleDailyFundamentalJob(queue: Queue): Promise<void> {
  await queue.add(
    "sync-fundamentals",
    {},
    {
      repeat: {
        pattern: WEEKDAY_EOD_CRON.FUNDAMENTALS_0300,
        tz: "Etc/UTC",
      },
      jobId: "daily-fundamentals-weekdays-3am-utc",
    },
  );
}
