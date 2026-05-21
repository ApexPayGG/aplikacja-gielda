import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { isMarketEventsEnabled } from "../modules/marketEvents/config";
import { deliverWatchlistDailyDigest } from "../modules/marketEvents/eventDeliveryService";
import { STANDARD_INGEST_JOB_OPTIONS, runIngestJob } from "./schedulerConfig";

export const MARKET_EVENTS_DIGEST_QUEUE = "market-events-digest";

export function registerMarketEventsDigest(
  connection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(MARKET_EVENTS_DIGEST_QUEUE, { connection });

  const worker = new Worker(
    MARKET_EVENTS_DIGEST_QUEUE,
    async (job) => {
      if (!isMarketEventsEnabled()) {
        return { skipped: true, reason: "MARKET_EVENTS_ENABLED=0" };
      }
      return runIngestJob(
        {
          queue: MARKET_EVENTS_DIGEST_QUEUE,
          provider: "market_events_digest",
          jobId: job.id,
          jobName: job.name,
        },
        async () => deliverWatchlistDailyDigest(),
        { respectMarketHours: false },
      );
    },
    { connection: workerConnection },
  );

  return { queue, worker };
}

export async function scheduleDailyMarketEventsDigest(queue: Queue): Promise<void> {
  await queue.add(
    "watchlist-digest",
    {},
    {
      ...STANDARD_INGEST_JOB_OPTIONS,
      repeat: { pattern: "0 7 * * 1-5", tz: "Etc/UTC" },
      jobId: "daily-market-events-digest-weekdays-0700-utc",
    },
  );
}
