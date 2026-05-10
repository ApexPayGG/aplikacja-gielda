import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createEarningsRouter } from "../earnings";

describe("earnings routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createEarningsRouter({
        predictFn: async (symbol) => ({
          symbol,
          prediction: "BEAT",
          confidence: 74,
          reasoning: "Recent beats and improving growth support upside surprise odds.",
          nextEarningsDate: "2026-05-20",
        }),
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
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

  it("GET /api/earnings/predict/:symbol returns predictor payload", async () => {
    const res = await fetch(`${baseUrl}/api/earnings/predict/AAPL`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      symbol: string;
      prediction: string;
      confidence: number;
      nextEarningsDate: string;
    };
    assert.equal(body.symbol, "AAPL");
    assert.equal(body.prediction, "BEAT");
    assert.equal(body.confidence, 74);
    assert.equal(body.nextEarningsDate, "2026-05-20");
  });

  it("GET /api/earnings/predict/:symbol validates missing symbol", async () => {
    const res = await fetch(`${baseUrl}/api/earnings/predict/%20`);
    assert.equal(res.status, 400);
  });
});
