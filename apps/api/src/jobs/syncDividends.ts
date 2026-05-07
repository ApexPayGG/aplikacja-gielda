/**
 * BullMQ: daily dividend sync @ 01:00 UTC (after typical price EOD jobs).
 */
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { syncDividendHistory, loadTopDividendSymbols } from "../services/dividendDataService";

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
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
    },
  });
  const worker = new Worker(
    DIVIDEND_QUEUE_NAME,
    async (job) => {
      dividendJobLogger.info({ msg: "start", jobId: job.id, name: job.name });
      try {
        const symbols = await loadTopDividendSymbols(100);
        const out = await syncDividendHistory(symbols);
        dividendJobLogger.info({
          msg: "end",
          jobId: job.id,
          synced: out.synced,
          failed: out.failed,
          total: symbols.length,
        });
        return out;
      } catch (e) {
        dividendJobLogger.error({
          msg: "fatal",
          jobId: job.id,
          err: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
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
        pattern: "0 1 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-dividend-1am-utc",
    },
  );
}
