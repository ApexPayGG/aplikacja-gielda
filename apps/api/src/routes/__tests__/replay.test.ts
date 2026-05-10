import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createReplayRouter } from "../replay";

describe("replay routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createReplayRouter({
        getSnapshotFn: async (symbol, date) => ({
          symbol,
          date,
          open: 100,
          high: 105,
          low: 98,
          close: 102,
          volume: 123_456,
          priceChange5d: 3.25,
        }),
        evaluateFn: async () => ({
          score: 8,
          explanation: "Reasonable decision in the given context. Risk/reward was acceptable.",
          actualOutcome: 3.25,
        }),
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("GET /api/replay/snapshot returns replay snapshot", async () => {
    const res = await fetch(`${baseUrl}/api/replay/snapshot?symbol=PKN&date=2025-01-15`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { symbol: string; priceChange5d: number };
    assert.equal(body.symbol, "PKN");
    assert.equal(body.priceChange5d, 3.25);
  });

  it("GET /api/replay/snapshot validates required params", async () => {
    const res = await fetch(`${baseUrl}/api/replay/snapshot?symbol=PKN`);
    assert.equal(res.status, 400);
  });

  it("POST /api/replay/evaluate returns AI result", async () => {
    const res = await fetch(`${baseUrl}/api/replay/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        symbol: "PKN",
        date: "2025-01-15",
        action: "BUY",
        price: 62.5,
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { score: number; explanation: string; actualOutcome: number };
    assert.equal(body.score, 8);
    assert.equal(typeof body.explanation, "string");
    assert.equal(body.actualOutcome, 3.25);
  });

  it("POST /api/replay/evaluate validates action", async () => {
    const res = await fetch(`${baseUrl}/api/replay/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        symbol: "PKN",
        date: "2025-01-15",
        action: "HOLD",
        price: 62.5,
      }),
    });
    assert.equal(res.status, 400);
  });
});
