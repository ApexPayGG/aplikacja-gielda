import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiscordSignalAlertDispatcher, sendSignalAlertWebhook } from "../discordWebhook";

function createMemoryRedis() {
  const strings = new Map<string, number>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  return {
    incr: async (key: string) => {
      const next = (strings.get(key) ?? 0) + 1;
      strings.set(key, next);
      return next;
    },
    expire: async (_key: string, _seconds: number) => 1,
    rpush: async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      const from = start < 0 ? Math.max(0, list.length + start) : start;
      const toInclusive = stop < 0 ? list.length + stop : stop;
      return list.slice(from, toInclusive + 1);
    },
    lpop: async (key: string) => {
      const list = lists.get(key) ?? [];
      const out = list.shift() ?? null;
      lists.set(key, list);
      return out;
    },
    del: async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (lists.delete(key)) deleted += 1;
        if (strings.delete(key)) deleted += 1;
      }
      return deleted;
    },
    sadd: async (key: string, ...members: string[]) => {
      const set = sets.get(key) ?? new Set<string>();
      let added = 0;
      for (const m of members) {
        const before = set.size;
        set.add(m);
        if (set.size > before) added += 1;
      }
      sets.set(key, set);
      return added;
    },
    smembers: async (key: string) => [...(sets.get(key) ?? new Set<string>())],
  };
}

describe("discordWebhook integration", () => {
  it("sends rich embed payload to webhook", async () => {
    const oldWebhook = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = "https://discord.test/webhook";
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    try {
      await sendSignalAlertWebhook(
        "AAPL",
        "breakout",
        82,
        "Momentum remains constructive with broad participation and low volatility backdrop.",
        {
          confidence: 87,
          timeframe: "4H",
          setup: "breakout retest",
          entry: 183.25,
          stopLoss: 179.9,
          takeProfit: 192.4,
        },
        async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            status: 204,
            text: async () => "",
          };
        },
      );

      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://discord.test/webhook");
      const body = JSON.parse(String(calls[0]?.init?.body ?? "{}")) as {
        embeds?: Array<{
          title?: string;
          fields?: Array<{ name?: string; value?: string }>;
        }>;
      };
      assert.ok(Array.isArray(body.embeds));
      assert.match(body.embeds?.[0]?.title ?? "", /AAPL/);
      const fieldNames = (body.embeds?.[0]?.fields ?? []).map((f) => f.name ?? "");
      assert.ok(fieldNames.includes("Ticker"));
      assert.ok(fieldNames.includes("Setup"));
      assert.ok(fieldNames.includes("Timeframe"));
      assert.ok(fieldNames.includes("Risk Score"));
      assert.ok(fieldNames.includes("Confidence"));
      assert.ok(fieldNames.includes("Levels"));
      assert.ok(fieldNames.includes("Chart"));
      assert.ok(fieldNames.includes("Action"));
    } finally {
      process.env.DISCORD_WEBHOOK_URL = oldWebhook;
    }
  });

  it("rate limits regular signals to 10 per window", async () => {
    const oldWebhook = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = "https://discord.test/webhook";
    const sentAt: number[] = [];
    const startedAt = Date.now();
    const windowMs = 40;
    const dispatcher = new DiscordSignalAlertDispatcher({
      maxPerMinute: 10,
      minuteMs: windowMs,
      redisClient: createMemoryRedis(),
      fetchFn: async () => {
        sentAt.push(Date.now() - startedAt);
        return { ok: true, status: 204, text: async () => "" };
      },
    });

    try {
      const tasks = Array.from({ length: 25 }, (_, i) =>
        dispatcher.dispatchSignalAlert({
          ticker: `A${i}`,
          signal: "momentum",
          score: 70,
          brief: "Regular signal",
          meta: { logicalChannel: "momentum" },
        }),
      );
      await Promise.all(tasks);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await dispatcher.flushAllBatches();
      await new Promise((resolve) => setTimeout(resolve, 60));
      await dispatcher.flushAllBatches();
      assert.equal(sentAt.length, 25);
      const firstWindow = sentAt.filter((t) => t < windowMs).length;
      assert.ok(firstWindow <= 10, `expected <=10 in first window, got ${firstWindow}`);
    } finally {
      dispatcher.dispose();
      process.env.DISCORD_WEBHOOK_URL = oldWebhook;
    }
  });

  it("batches small signals and sends one grouped message", async () => {
    const oldWebhook = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = "https://discord.test/webhook";
    const payloads: Array<Record<string, unknown>> = [];
    const dispatcher = new DiscordSignalAlertDispatcher({
      redisClient: createMemoryRedis(),
      fetchFn: async (_url, init) => {
        payloads.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return { ok: true, status: 204, text: async () => "" };
      },
    });

    try {
      await Promise.all([
        dispatcher.dispatchSignalAlert({ ticker: "AAA", signal: "mean_reversion", score: 45, brief: "low1" }),
        dispatcher.dispatchSignalAlert({ ticker: "BBB", signal: "mean_reversion", score: 50, brief: "low2" }),
        dispatcher.dispatchSignalAlert({ ticker: "CCC", signal: "mean_reversion", score: 59, brief: "low3" }),
      ]);
      await dispatcher.flushAllBatches();
      assert.equal(payloads.length, 1);
      const embeds = (payloads[0].embeds as Array<{ title?: string; description?: string }>) ?? [];
      assert.match(embeds[0]?.title ?? "", /Batched Signals/);
      assert.match(embeds[0]?.description ?? "", /AAA/);
      assert.match(embeds[0]?.description ?? "", /BBB/);
      assert.match(embeds[0]?.description ?? "", /CCC/);
    } finally {
      dispatcher.dispose();
      process.env.DISCORD_WEBHOOK_URL = oldWebhook;
    }
  });

  it("load test handles 100 signals per minute without drops", async () => {
    const oldWebhook = process.env.DISCORD_WEBHOOK_URL;
    process.env.DISCORD_WEBHOOK_URL = "https://discord.test/webhook";
    let sent = 0;
    const dispatcher = new DiscordSignalAlertDispatcher({
      maxPerMinute: 10,
      minuteMs: 20,
      redisClient: createMemoryRedis(),
      fetchFn: async () => {
        sent += 1;
        return { ok: true, status: 204, text: async () => "" };
      },
    });

    try {
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          dispatcher.dispatchSignalAlert({
            ticker: `S${i}`,
            signal: "breakout",
            score: 72,
            brief: "load",
            meta: { logicalChannel: "breakout" },
          }),
        ),
      );
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await dispatcher.flushAllBatches();
      }
      assert.equal(sent, 100);
    } finally {
      dispatcher.dispose();
      process.env.DISCORD_WEBHOOK_URL = oldWebhook;
    }
  });
});
