import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createNewsHalfLifeRouter } from "../newshalflife";

describe("news half-life routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createNewsHalfLifeRouter({
        getNewsHalfLifeFn: async (symbol) => ({
          symbol: symbol.toUpperCase(),
          news: [
            {
              headline: "Fed keeps rates unchanged",
              date: "2026-05-08T00:00:00.000Z",
              halfLifeDays: 14,
              expiresAt: "2026-05-22T00:00:00.000Z",
              reason: "Macro policy shift lingers in valuation",
              category: "fed/central bank",
            },
          ],
          mostImpactful: {
            headline: "Fed keeps rates unchanged",
            halfLifeDays: 14,
          },
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

  it("GET /api/news/halflife/:symbol returns half-life payload", async () => {
    const res = await fetch(`${baseUrl}/api/news/halflife/aapl`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      symbol: string;
      news: Array<{ halfLifeDays: number; category: string }>;
      mostImpactful: { headline: string; halfLifeDays: number };
    };
    assert.equal(body.symbol, "AAPL");
    assert.equal(body.news[0]?.halfLifeDays, 14);
    assert.equal(body.news[0]?.category, "fed/central bank");
    assert.equal(body.mostImpactful.halfLifeDays, 14);
  });

  it("GET /api/news/halflife/:symbol validates missing symbol", async () => {
    const res = await fetch(`${baseUrl}/api/news/halflife/%20`);
    assert.equal(res.status, 400);
  });
});
