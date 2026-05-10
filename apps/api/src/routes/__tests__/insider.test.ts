import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createInsiderRouter } from "../insider";

describe("insider routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createInsiderRouter({
        getInsiderMirrorFn: async (symbol) => ({
          symbol,
          transactions: [
            {
              name: "Jane Doe",
              role: "CEO",
              action: "BUY",
              value: 250_000,
              date: "2026-04-15",
            },
            {
              name: "John Smith",
              role: "CFO",
              action: "SELL",
              value: 75_000,
              date: "2026-04-10",
            },
          ],
          netSentiment: "BUY",
          insight: "CEO doubling down signals confidence despite recent CFO trim.",
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

  it("GET /api/insider/:symbol returns mirror payload", async () => {
    const res = await fetch(`${baseUrl}/api/insider/aapl`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      symbol: string;
      transactions: Array<{ name: string; action: string }>;
      netSentiment: string;
      insight: string;
    };
    assert.equal(body.symbol, "AAPL");
    assert.equal(body.transactions.length, 2);
    assert.equal(body.transactions[0].name, "Jane Doe");
    assert.equal(body.transactions[0].action, "BUY");
    assert.equal(body.netSentiment, "BUY");
    assert.ok(body.insight.length > 0);
  });

  it("GET /api/insider/:symbol rejects empty symbol", async () => {
    const res = await fetch(`${baseUrl}/api/insider/%20`);
    assert.equal(res.status, 400);
  });
});
