import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createCorrelationRouter } from "../correlation";

describe("correlation routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createCorrelationRouter({
        analyzeFn: async (symbol, portfolio) => ({
          correlations: portfolio.map((item) => ({
            symbol: item,
            correlation: item === "MSFT" ? 0.82 : 0.22,
            warning: item === "MSFT",
          })),
          highRiskPairs: [{ a: symbol, b: "MSFT", correlation: 0.82 }],
          insight: "AAPL and MSFT move together; reduce overlap to limit drawdown risk.",
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

  it("POST /api/correlation/analyze returns correlations and insight", async () => {
    const res = await fetch(`${baseUrl}/api/correlation/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        symbol: "AAPL",
        portfolio: ["MSFT", "TSLA"],
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      correlations: Array<{ symbol: string; warning: boolean }>;
      highRiskPairs: Array<{ a: string; b: string; correlation: number }>;
      insight: string;
    };
    assert.equal(body.correlations.length, 2);
    assert.equal(body.correlations[0]?.symbol, "MSFT");
    assert.equal(body.correlations[0]?.warning, true);
    assert.equal(body.highRiskPairs[0]?.a, "AAPL");
    assert.equal(typeof body.insight, "string");
  });

  it("POST /api/correlation/analyze validates symbol and portfolio", async () => {
    const res = await fetch(`${baseUrl}/api/correlation/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: "", portfolio: "MSFT" }),
    });
    assert.equal(res.status, 400);
  });
});
