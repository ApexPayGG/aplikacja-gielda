/**
 * BullMQ: daily fundamentals sync @ 03:00 UTC (po jobie dywidend 01:00).
 */
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { loadTopDividendSymbols } from "../services/dividendDataService";
import { syncFundamentalsForSymbols } from "../services/fundamentalDataService";

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
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });

  const worker = new Worker(
    FUNDAMENTAL_QUEUE_NAME,
    async (job) => {
      fundamentalJobLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const symbols = await loadTopDividendSymbols(100);
      const out = await syncFundamentalsForSymbols(symbols);
      fundamentalJobLogger.info({
        msg: "end",
        jobId: job.id,
        symbolsTotal: out.symbolsTotal,
        symbolsOk: out.symbolsOk,
        symbolsFailed: out.symbolsFailed,
        rowsUpserted: out.rowsUpserted,
      });
      if (out.errors.length > 0) {
        fundamentalJobLogger.warn({ msg: "partial_errors", count: out.errors.length, sample: out.errors.slice(0, 5) });
      }
      return out;
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
        pattern: "0 3 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-fundamentals-3am-utc",
    },
  );
}
