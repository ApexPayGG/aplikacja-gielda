import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  isSingleFlightLockHeld,
  SingleFlightTimeoutError,
  withSingleFlight,
  type SingleFlightRedis,
} from "../singleFlight.js";

function createMockRedis(): { redis: SingleFlightRedis; store: Map<string, string> } {
  const store = new Map<string, string>();
  const redis: SingleFlightRedis = {
    async set(key, value, _ex, _ttl, nx) {
      if (nx === "NX" && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
  return { redis, store };
}

describe("withSingleFlight", () => {
  it("first caller acquires lock and executes fn once", async () => {
    const { redis } = createMockRedis();
    const fn = mock.fn(async () => 42);

    const result = await withSingleFlight("lock:test:1", { redis, scope: "test" }, fn);
    assert.equal(result, 42);
    assert.equal(fn.mock.callCount(), 1);
  });

  it("second caller waits and does not execute fn when readAfterWait returns value", async () => {
    const { redis, store } = createMockRedis();
    const fn = mock.fn(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return "from-fn";
    });
    let shared = 0;

    const leader = withSingleFlight(
      "lock:test:2",
      { redis, lockTtlSeconds: 30, maxWaitMs: 3000, waitMs: 50, scope: "test" },
      fn,
    );

    await new Promise((r) => setTimeout(r, 10));
    assert.ok(store.has("lock:test:2"));

    const waiter = withSingleFlight(
      "lock:test:2",
      {
        redis,
        maxWaitMs: 3000,
        waitMs: 50,
        scope: "test",
        readAfterWait: async () => {
          shared += 1;
          return shared >= 2 ? "from-cache" : null;
        },
      },
      async () => "should-not-run",
    );

    const [a, b] = await Promise.all([leader, waiter]);
    assert.equal(a, "from-fn");
    assert.equal(b, "from-cache");
    assert.equal(fn.mock.callCount(), 1);
  });

  it("timeout does not execute fn by default", async () => {
    const { redis, store } = createMockRedis();
    store.set("lock:test:3", "foreign-token");
    const fn = mock.fn(async () => "nope");

    await assert.rejects(
      () =>
        withSingleFlight(
          "lock:test:3",
          { redis, maxWaitMs: 200, waitMs: 50, scope: "test" },
          fn,
        ),
      SingleFlightTimeoutError,
    );
    assert.equal(fn.mock.callCount(), 0);
  });

  it("release does not delete lock if token changed before release", async () => {
    const { redis, store } = createMockRedis();
    const fn = mock.fn(async () => {
      store.set("lock:test:4", "other-token");
      return 1;
    });
    await withSingleFlight("lock:test:4", { redis, lockTtlSeconds: 30, scope: "test" }, fn);
    assert.equal(store.get("lock:test:4"), "other-token");
    assert.equal(fn.mock.callCount(), 1);
  });

  it("releases lock after fn error", async () => {
    const { redis, store } = createMockRedis();
    const fn = mock.fn(async () => {
      throw new Error("boom");
    });

    await assert.rejects(() => withSingleFlight("lock:test:5", { redis, scope: "test" }, fn));
    assert.equal(store.has("lock:test:5"), false);
  });

  it("isSingleFlightLockHeld reflects Redis key presence", async () => {
    const { redis, store } = createMockRedis();
    store.set("lock:test:held", "token");
    assert.equal(await isSingleFlightLockHeld("lock:test:held", redis), true);
    store.delete("lock:test:held");
    assert.equal(await isSingleFlightLockHeld("lock:test:held", redis), false);
  });
});
