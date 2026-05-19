import process from "node:process";
import IORedis from "ioredis";

/** BullMQ requires `maxRetriesPerRequest: null` on each connection. */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }

  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 10_000,
    retryStrategy(times) {
      const delay = Math.min(200 + times * 300, 5000);
      if (times > 20) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "redis_retry_exhausted",
            times,
          }),
        );
        return null;
      }
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "redis_reconnecting",
          attempt: times,
          delayMs: delay,
        }),
      );
      return delay;
    },
    reconnectOnError(err) {
      const message = err?.message ?? "";
      if (message.includes("READONLY")) {
        console.warn(JSON.stringify({ level: "warn", event: "redis_readonly_reconnect" }));
        return true;
      }
      return false;
    },
  });

  client.on("connect", () => {
    console.log(JSON.stringify({ level: "info", event: "redis_connect" }));
  });

  client.on("ready", () => {
    console.log(JSON.stringify({ level: "info", event: "redis_ready" }));
  });

  client.on("error", (err) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "redis_error",
        err: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  client.on("close", () => {
    console.warn(JSON.stringify({ level: "warn", event: "redis_close" }));
  });

  return client;
}

let cacheClient: IORedis | undefined;

/** Shared Redis for cache / queues. TTLs and key naming: `src/config/redis.ts`. */
export function getCacheRedis(): IORedis {
  if (!cacheClient) {
    cacheClient = createRedisConnection();
  }
  return cacheClient;
}
