/**
 * BullMQ: daily dividend sync @ 01:00 UTC (after typical price EOD jobs).
 */
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { syncDividendHistory, loadTopDividendSymbols } from "../services/dividendDataService";
import { runIngestJob, STANDARD_INGEST_JOB_OPTIONS, WEEKDAY_EOD_CRON } from "./schedulerConfig";

export const DIVIDEND_QUEUE_NAME = "dividend-sync";

export const dividendJobLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "dividend_job" },
});

export function registerDividendSync(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(DIVIDEND_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { ...STANDARD_INGEST_JOB_OPTIONS },
  });
  const worker = new Worker(
    DIVIDEND_QUEUE_NAME,
    async (job) => {
      return runIngestJob(
        { queue: DIVIDEND_QUEUE_NAME, provider: "eodhd", jobId: job.id, jobName: job.name },
        async () => {
          dividendJobLogger.info({ msg: "start", jobId: job.id, name: job.name, provider: "eodhd" });
          const symbols = await loadTopDividendSymbols(100);
          const out = await syncDividendHistory(symbols);
          dividendJobLogger.info({
            msg: "end",
            jobId: job.id,
            provider: "eodhd",
            synced: out.synced,
            failed: out.failed,
            total: symbols.length,
          });
          if (out.failed > 0 && out.synced === 0) {
            throw new Error(`EODHD dividend sync failed for all ${symbols.length} symbols`);
          }
          return out;
        },
        { respectMarketHours: false },
      );
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    dividendJobLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker };
}

/** Repeatable job: every day 01:00 UTC */
export async function scheduleDailyDividendJob(queue: Queue): Promise<void> {
  await queue.add(
    "sync-dividends",
    {},
    {
      repeat: {
        pattern: WEEKDAY_EOD_CRON.DIVIDEND_0100,
        tz: "Etc/UTC",
      },
      jobId: "daily-dividend-weekdays-1am-utc",
    },
  );
}
