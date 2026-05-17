import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createStrategyDnaRouter } from "../strategydna";

describe("strategy dna routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createStrategyDnaRouter({
        getStrategyDnaFn: async (userId) => ({
          primary: { name: "BUFFETT", pct: 72 },
          secondary: { name: "LYNCH", pct: 28 },
          insight: `Insight for ${userId}`,
          stats: {
            avgHoldingDays: 214,
            winRate: 0.64,
            avgWinPct: 5.2,
            avgLossPct: -2.9,
            preferredSectors: ["Energy", "Financial Services", "Utilities"],
            riskTolerance: 0.56,
          },
          hasEnoughData: true,
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

  it("GET /api/strategydna/:userId returns strategy dna payload", async () => {
    const res = await fetch(`${baseUrl}/api/strategydna/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      primary: { name: string; pct: number };
      secondary: { name: string; pct: number };
      hasEnoughData: boolean;
    };
    assert.equal(body.primary.name, "BUFFETT");
    assert.equal(body.secondary.pct, 28);
    assert.equal(body.hasEnoughData, true);
  });

  it("GET /api/strategydna/:userId validates missing userId", async () => {
    const res = await fetch(`${baseUrl}/api/strategydna/%20`);
    assert.equal(res.status, 400);
  });
});
