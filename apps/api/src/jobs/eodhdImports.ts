import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pino from "pino";
import { runIngestJob, STANDARD_INGEST_JOB_OPTIONS, WEEKDAY_EOD_CRON } from "./schedulerConfig";

export const EODHD_GPW_IMPORT_QUEUE_NAME = "eodhd-import-gpw";
export const EODHD_GLOBAL_IMPORT_QUEUE_NAME = "eodhd-import-global";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GPW_SCRIPT = "src/scripts/importEodhd.ts";
const GLOBAL_SCRIPT = "src/scripts/importEodhdGlobal.ts";

export const eodhdImportLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "eodhd_import_job" },
});

function runTypescriptScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx/esm", scriptPath],
      {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        env: process.env,
      },
    );

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Script ${scriptPath} failed with code=${code ?? "null"} signal=${signal ?? "none"}`));
    });
  });
}

export function registerEodhdGpwImport(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(EODHD_GPW_IMPORT_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { ...STANDARD_INGEST_JOB_OPTIONS },
  });

  const worker = new Worker(
    EODHD_GPW_IMPORT_QUEUE_NAME,
    async (job) => {
      const result = await runIngestJob(
        { queue: EODHD_GPW_IMPORT_QUEUE_NAME, provider: "eodhd", jobId: job.id, jobName: job.name },
        async () => {
          eodhdImportLogger.info({ msg: "start_gpw", jobId: job.id, name: job.name, provider: "eodhd" });
          await runTypescriptScript(GPW_SCRIPT);
          eodhdImportLogger.info({ msg: "end_gpw", jobId: job.id, provider: "eodhd" });
          return { ok: true };
        },
        { respectMarketHours: false },
      );
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    eodhdImportLogger.error({
      msg: "gpw_worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker };
}

export function registerEodhdGlobalImport(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(EODHD_GLOBAL_IMPORT_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { ...STANDARD_INGEST_JOB_OPTIONS },
  });

  const worker = new Worker(
    EODHD_GLOBAL_IMPORT_QUEUE_NAME,
    async (job) => {
      const result = await runIngestJob(
        { queue: EODHD_GLOBAL_IMPORT_QUEUE_NAME, provider: "eodhd", jobId: job.id, jobName: job.name },
        async () => {
          eodhdImportLogger.info({ msg: "start_global", jobId: job.id, name: job.name, provider: "eodhd" });
          await runTypescriptScript(GLOBAL_SCRIPT);
          eodhdImportLogger.info({ msg: "end_global", jobId: job.id, provider: "eodhd" });
          return { ok: true };
        },
        { respectMarketHours: false },
      );
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    eodhdImportLogger.error({
      msg: "global_worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker };
}

/** Codziennie 01:30 UTC */
export async function scheduleDailyEodhdGpwImportJob(queue: Queue): Promise<void> {
  await queue.add(
    "import-eodhd-gpw",
    {},
    {
      repeat: {
        pattern: WEEKDAY_EOD_CRON.EODHD_GPW_0130,
        tz: "Etc/UTC",
      },
      jobId: "daily-import-eodhd-gpw-weekdays-0130-utc",
    },
  );
}

/** Codziennie 02:00 UTC */
export async function scheduleDailyEodhdGlobalImportJob(queue: Queue): Promise<void> {
  await queue.add(
    "import-eodhd-global",
    {},
    {
      repeat: {
        pattern: WEEKDAY_EOD_CRON.EODHD_GLOBAL_0200,
        tz: "Etc/UTC",
      },
      jobId: "daily-import-eodhd-global-weekdays-0200-utc",
    },
  );
}
