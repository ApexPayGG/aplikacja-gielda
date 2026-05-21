import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { isMarketEventsEnabled } from "../modules/marketEvents/config";
import { deliverUpcomingEventAlerts } from "../modules/marketEvents/eventDeliveryService";
import {
  ensureSystemAnchorEvent,
  syncMarketEventsFromProviders,
} from "../modules/marketEvents/marketEventsService";
import { STANDARD_INGEST_JOB_OPTIONS, runIngestJob } from "./schedulerConfig";

export const MARKET_EVENTS_SYNC_QUEUE = "market-events-sync";

export function registerMarketEventsSync(
  connection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(MARKET_EVENTS_SYNC_QUEUE, { connection });

  const worker = new Worker(
    MARKET_EVENTS_SYNC_QUEUE,
    async (job) => {
      if (!isMarketEventsEnabled()) {
        return { skipped: true, reason: "MARKET_EVENTS_ENABLED=0" };
      }
      return runIngestJob(
        { queue: MARKET_EVENTS_SYNC_QUEUE, provider: "market_events", jobId: job.id, jobName: job.name },
        async () => {
          await ensureSystemAnchorEvent();
          const sync = await syncMarketEventsFromProviders();
          const alerts = await deliverUpcomingEventAlerts();
          return { ...sync, alerts };
        },
        { respectMarketHours: false },
      );
    },
    { connection: workerConnection },
  );

  return { queue, worker };
}

export async function scheduleDailyMarketEventsSync(queue: Queue): Promise<void> {
  await queue.add(
    "sync-market-events",
    {},
    {
      ...STANDARD_INGEST_JOB_OPTIONS,
      repeat: { pattern: "30 5 * * 1-5", tz: "Etc/UTC" },
      jobId: "daily-market-events-sync-weekdays-0530-utc",
    },
  );
}
