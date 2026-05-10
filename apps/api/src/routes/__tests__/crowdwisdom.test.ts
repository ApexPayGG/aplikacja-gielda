import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createCrowdWisdomRouter } from "../crowdwisdom";

describe("crowdwisdom routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createCrowdWisdomRouter({
        getCrowdWisdomFn: async (symbol) => ({
          symbol,
          retailBullish: 72,
          insiderBuying: 28,
          divergence: -44,
          insight: "Crowd euphoria contrasts with insider caution; consider tightening risk aggressively.",
          signal: "CONTRARIAN_SELL",
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

  it("GET /api/crowdwisdom/:symbol returns computed payload", async () => {
    const res = await fetch(`${baseUrl}/api/crowdwisdom/pkn`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      symbol: string;
      retailBullish: number;
      divergence: number;
      signal: string;
    };
    assert.equal(body.symbol, "PKN");
    assert.equal(body.retailBullish, 72);
    assert.equal(body.divergence, -44);
    assert.equal(body.signal, "CONTRARIAN_SELL");
  });
});
