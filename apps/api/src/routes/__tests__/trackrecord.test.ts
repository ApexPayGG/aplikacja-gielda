import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createTrackRecordRouter } from "../trackrecord";

describe("trackrecord routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createTrackRecordRouter({
        generateFn: async (userId) => ({
          userId,
          publicHash: "hash-123",
          winRate: 60,
          totalTrades: 10,
          avgReturn: 2.5,
          bestTradePct: 11.2,
          worstTradePct: -5.1,
          generatedAt: new Date("2026-01-01T10:00:00.000Z"),
          bestTrade: { symbol: "AAPL", pct: 11.2 },
          worstTrade: { symbol: "MSFT", pct: -5.1 },
          maxWinStreak: 3,
        }),
        getPublicFn: async (hash) =>
          hash === "hash-123"
            ? {
                publicHash: hash,
                winRate: 60,
                totalTrades: 10,
                avgReturn: 2.5,
                bestTradePct: 11.2,
                worstTradePct: -5.1,
                generatedAt: new Date("2026-01-01T10:00:00.000Z"),
              }
            : null,
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

  it("POST /api/trackrecord/generate/:userId returns public hash and share URL", async () => {
    const res = await fetch(`${baseUrl}/api/trackrecord/generate/demo-user`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { publicHash: string; shareUrl: string };
    assert.equal(body.publicHash, "hash-123");
    assert.equal(body.shareUrl, "stock-ai.pro/track-record/public/hash-123");
  });

  it("POST /api/trackrecord/generate/:userId validates userId", async () => {
    const res = await fetch(`${baseUrl}/api/trackrecord/generate/%20%20`, { method: "POST" });
    assert.equal(res.status, 400);
  });

  it("GET /api/trackrecord/public/:hash returns anonymous metrics", async () => {
    const res = await fetch(`${baseUrl}/api/trackrecord/public/hash-123`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { winRate: number; totalTrades: number };
    assert.equal(body.winRate, 60);
    assert.equal(body.totalTrades, 10);
  });

  it("GET /api/trackrecord/public/:hash returns 404 for unknown hash", async () => {
    const res = await fetch(`${baseUrl}/api/trackrecord/public/unknown-hash`);
    assert.equal(res.status, 404);
  });
});
