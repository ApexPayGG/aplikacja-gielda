import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createVolatilityRouter } from "../volatility";

describe("volatility routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createVolatilityRouter({
        getVolatilityHeatmapFn: async (symbol) => ({
          symbol: symbol.toUpperCase(),
          heatmap: [
            { year: 2024, month: 1, volatility: 2.4, avgReturn: 0.8 },
            { year: 2024, month: 2, volatility: 3.1, avgReturn: -0.2 },
          ],
          mostVolatileMonth: "February",
          leastVolatileMonth: "January",
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

  it("GET /api/volatility/heatmap/:symbol returns heatmap payload", async () => {
    const res = await fetch(`${baseUrl}/api/volatility/heatmap/aapl`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      symbol: string;
      heatmap: Array<{ year: number; month: number; volatility: number; avgReturn: number }>;
      mostVolatileMonth: string;
      leastVolatileMonth: string;
    };
    assert.equal(body.symbol, "AAPL");
    assert.equal(body.heatmap.length, 2);
    assert.equal(body.heatmap[1]?.month, 2);
    assert.equal(body.mostVolatileMonth, "February");
    assert.equal(body.leastVolatileMonth, "January");
  });

  it("GET /api/volatility/heatmap/:symbol validates missing symbol", async () => {
    const res = await fetch(`${baseUrl}/api/volatility/heatmap/%20`);
    assert.equal(res.status, 400);
  });
});
