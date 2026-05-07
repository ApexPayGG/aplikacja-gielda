import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createCopilotRouter } from "../copilot";

class InMemoryRateStore {
  private readonly data = new Map<string, { count: number; expiresAt: number }>();

  async incr(key: string): Promise<number> {
    const now = Date.now();
    const row = this.data.get(key);
    if (!row || row.expiresAt <= now) {
      this.data.set(key, { count: 1, expiresAt: now + 60_000 });
      return 1;
    }
    row.count += 1;
    return row.count;
  }

  async expire(key: string, sec: number): Promise<number> {
    const row = this.data.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + sec * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const row = this.data.get(key);
    if (!row) return -2;
    return Math.max(0, Math.ceil((row.expiresAt - Date.now()) / 1000));
  }
}

describe("copilot route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  async function post(body: unknown): Promise<{ status: number; json: any }> {
    const res = await fetch(`${baseUrl}/api/copilot/query`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  }

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createCopilotRouter({
        parseIntentFn: async (query) => {
          if (query.includes("invalid exchange")) {
            return { market: ["INVALID"], pattern: "breakout", filters: {} };
          }
          if (query.includes("Szukam")) {
            return { market: ["GPW"], pattern: "breakout", filters: {} };
          }
          return { market: ["NYSE", "NASDAQ"], pattern: "dividend_growth", filters: {} };
        },
        generateSQLFn: async (intent) => {
          if (intent.market.includes("INVALID")) throw new Error('Invalid exchange "INVALID"');
          return {
            query: "SELECT * FROM signals WHERE s.exchange = ? AND s.pattern_type = ? ORDER BY s.score DESC LIMIT 20",
            params: [intent.market[0], intent.pattern],
          };
        },
        runQueryFn: async () =>
          Array.from({ length: 6 }, (_, i) => ({
            id: `sig_${i + 1}`,
            ticker: i % 2 === 0 ? "AAPL" : "MSFT",
            score: 70 + i,
          })),
        rateStore: new InMemoryRateStore() as never,
        getClientIp: () => "test-ip-1",
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test server address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("POST /api/copilot/query with Polish query returns intent + results", async () => {
    const res = await post({ query: "Szukam breakout'ów na GPW", language: "pl" });
    assert.equal(res.status, 200);
    assert.equal(res.json.intent.pattern, "breakout");
    assert.equal(res.json.intent.market[0], "GPW");
    assert.ok(Array.isArray(res.json.results));
    assert.ok(res.json.count >= 5 && res.json.count <= 10);
  });

  it("POST /api/copilot/query with English query returns same structure", async () => {
    const res = await post({ query: "Tech stocks with high dividend", language: "en" });
    assert.equal(res.status, 200);
    assert.equal(res.json.intent.pattern, "dividend_growth");
    assert.ok(Array.isArray(res.json.results));
    assert.equal(typeof res.json.message, "string");
  });

  it("POST with invalid exchange returns 400", async () => {
    const res = await post({ query: "invalid exchange test", language: "en" });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid exchange/);
  });

  it("POST without query returns 400", async () => {
    const res = await post({ language: "pl" });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing query/);
  });

  it("rate limit returns 429 on 11th request in 60s", async () => {
    for (let i = 0; i < 10; i += 1) {
      const okRes = await post({ query: "Szukam breakout'ów na GPW", language: "pl" });
      assert.equal(okRes.status, 200);
    }
    const blocked = await post({ query: "Szukam breakout'ów na GPW", language: "pl" });
    assert.equal(blocked.status, 429);
  });
});
