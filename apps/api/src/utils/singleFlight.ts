import { randomUUID } from "node:crypto";
import pino from "pino";
import { isRedisConfigured } from "../config/redis";
import { getCacheRedis } from "../redis";

const singleFlightLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "single_flight" },
});

/** Minimal Redis surface for unit tests (no real Redis required). */
export type SingleFlightRedis = {
  set(key: string, value: string, exMode: "EX", ttlSeconds: number, nxFlag: "NX"): Promise<string | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
};

export type WithSingleFlightOptions<T> = {
  lockTtlSeconds?: number;
  /** Poll interval while waiting for another holder (ms). */
  waitMs?: number;
  maxWaitMs?: number;
  /** When true and wait times out, run fn() anyway (use sparingly). */
  allowFallbackExecution?: boolean;
  /** Called while waiting; return non-null/undefined to skip fn execution. */
  readAfterWait?: () => Promise<T | null | undefined>;
  scope?: string;
  redis?: SingleFlightRedis;
};

export class SingleFlightTimeoutError extends Error {
  readonly lockKey: string;

  constructor(lockKey: string, scope?: string) {
    super(scope ? `Single-flight timeout (${scope})` : "Single-flight timeout");
    this.name = "SingleFlightTimeoutError";
    this.lockKey = lockKey;
  }
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRedis(custom?: SingleFlightRedis): SingleFlightRedis | null {
  if (custom) return custom;
  if (!isRedisConfigured()) return null;
  const client = getCacheRedis();
  return {
    set: (key, value, exMode, ttlSeconds, nxFlag) =>
      client.set(key, value, exMode, ttlSeconds, nxFlag) as Promise<string | null>,
    get: (key) => client.get(key),
    del: (key) => client.del(key),
  };
}

async function acquireMemoryLock(lockKey: string, token: string, ttlSec: number): Promise<boolean> {
  const now = Date.now();
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now && existing.token !== token) {
    return false;
  }
  memoryLocks.set(lockKey, { token, expiresAt: now + ttlSec * 1000 });
  return true;
}

async function releaseMemoryLock(lockKey: string, token: string): Promise<boolean> {
  const existing = memoryLocks.get(lockKey);
  if (existing?.token === token) {
    memoryLocks.delete(lockKey);
    return true;
  }
  return false;
}

async function acquireLock(
  redis: SingleFlightRedis | null,
  lockKey: string,
  token: string,
  ttlSec: number,
  scope: string,
): Promise<boolean> {
  if (!redis) {
    const ok = await acquireMemoryLock(lockKey, token, ttlSec);
    if (ok) singleFlightLogger.info({ msg: "single_flight_acquired", scope, lockKey });
    return ok;
  }
  try {
    const ok = await redis.set(lockKey, token, "EX", ttlSec, "NX");
    if (ok === "OK") {
      singleFlightLogger.info({ msg: "single_flight_acquired", scope, lockKey });
      return true;
    }
    return false;
  } catch {
    const ok = await acquireMemoryLock(lockKey, token, ttlSec);
    if (ok) singleFlightLogger.info({ msg: "single_flight_acquired", scope, lockKey, fallback: "memory" });
    return ok;
  }
}

async function releaseLock(
  redis: SingleFlightRedis | null,
  lockKey: string,
  token: string,
  scope: string,
): Promise<void> {
  if (!redis) {
    const released = await releaseMemoryLock(lockKey, token);
    if (released) {
      singleFlightLogger.info({ msg: "single_flight_released", scope, lockKey });
    } else {
      singleFlightLogger.debug({ msg: "single_flight_release_skipped_token_mismatch", scope, lockKey });
    }
    return;
  }
  try {
    const current = await redis.get(lockKey);
    if (current === token) {
      await redis.del(lockKey);
      singleFlightLogger.info({ msg: "single_flight_released", scope, lockKey });
    } else {
      singleFlightLogger.debug({ msg: "single_flight_release_skipped_token_mismatch", scope, lockKey });
    }
  } catch {
    await releaseMemoryLock(lockKey, token);
  }
}

/** True when another holder still owns the single-flight lock (Redis key exists). */
export async function isSingleFlightLockHeld(
  lockKey: string,
  redis?: SingleFlightRedis,
): Promise<boolean> {
  const client = resolveRedis(redis);
  if (!client) {
    const entry = memoryLocks.get(lockKey);
    return entry !== undefined && entry.expiresAt > Date.now();
  }
  try {
    const current = await client.get(lockKey);
    return current !== null && current !== undefined;
  } catch {
    const entry = memoryLocks.get(lockKey);
    return entry !== undefined && entry.expiresAt > Date.now();
  }
}

async function waitForResult<T>(
  readAfterWait: (() => Promise<T | null | undefined>) | undefined,
  maxWaitMs: number,
  pollMs: number,
  scope: string,
  lockKey: string,
): Promise<T | null> {
  if (!readAfterWait) return null;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    singleFlightLogger.debug({ msg: "single_flight_wait", scope, lockKey });
    const hit = await readAfterWait();
    if (hit !== null && hit !== undefined) {
      singleFlightLogger.info({ msg: "single_flight_cache_hit_after_wait", scope, lockKey });
      return hit;
    }
    await sleep(pollMs);
  }
  return null;
}

/**
 * Coalesce concurrent expensive work: one executor per lockKey; waiters poll readAfterWait.
 * Lock always expires via EX — never left without TTL.
 */
export async function withSingleFlight<T>(
  lockKey: string,
  options: WithSingleFlightOptions<T>,
  fn: () => Promise<T>,
): Promise<T> {
  const scope = options.scope ?? "default";
  const lockTtlSeconds = options.lockTtlSeconds ?? 60;
  const pollMs = options.waitMs ?? 400;
  const maxWaitMs = options.maxWaitMs ?? 8000;
  const redis = resolveRedis(options.redis);
  const token = randomUUID();

  const acquired = await acquireLock(redis, lockKey, token, lockTtlSeconds, scope);
  if (!acquired) {
    const waited = await waitForResult(options.readAfterWait, maxWaitMs, pollMs, scope, lockKey);
    if (waited !== null) return waited;

    singleFlightLogger.warn({ msg: "single_flight_timeout", scope, lockKey, maxWaitMs });
    if (!options.allowFallbackExecution) {
      throw new SingleFlightTimeoutError(lockKey, scope);
    }
    return fn();
  }

  try {
    if (options.readAfterWait) {
      const early = await options.readAfterWait();
      if (early !== null && early !== undefined) {
        singleFlightLogger.info({ msg: "single_flight_cache_hit_after_wait", scope, lockKey, phase: "leader_precheck" });
        return early;
      }
    }
    return await fn();
  } finally {
    await releaseLock(redis, lockKey, token, scope);
  }
}
