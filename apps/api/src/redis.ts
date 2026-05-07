import process from "node:process";
import IORedis from "ioredis";

/** BullMQ requires `maxRetriesPerRequest: null` on each connection. */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return new IORedis(url, { maxRetriesPerRequest: null });
}

let cacheClient: IORedis | undefined;

/** Shared Redis for cache / queues. TTLs and key naming: `src/config/redis.ts`. */
export function getCacheRedis(): IORedis {
  if (!cacheClient) {
    cacheClient = createRedisConnection();
  }
  return cacheClient;
}
