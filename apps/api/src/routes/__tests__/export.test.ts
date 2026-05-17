import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createExportRouter } from "../export";

describe("export CSV routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let authToken = "";
  const oldSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: "demo-user", email: "demo@example.com" });
  });

  afterEach(async () => {
    process.env.JWT_SECRET = oldSecret;
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  async function startWithRouter(router: ReturnType<typeof createExportRouter>): Promise<void> {
    const app = express();
    app.use(router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  it("GET /api/export/signals returns CSV with expected columns and filename", async () => {
    let capturedWhere: Record<string, unknown> | null = null;
    await startWithRouter(
      createExportRouter({
        db: {
          signal: {
            findMany: async (args: any) => {
              const where = args?.where as Record<string, unknown> | undefined;
              capturedWhere = where ?? null;
              return [
                {
                  created_at: new Date("2026-05-10T10:00:00.000Z"),
                  ticker: "AAPL",
                  pattern_type: "breakout",
                  score: 82,
                  confidence: 88,
                  win_rate: 61.2,
                  avg_return_10d: 3.4,
                  technical_data: {
                    entry_price: 185.2,
                    stop_loss: 179.9,
                    take_profit: 194.3,
                  },
                },
              ];
            },
          },
          paperTrade: { findMany: async () => [] },
          watchlist: { findMany: async () => [] },
          company: { findMany: async () => [] },
          dividend: { findMany: async () => [] },
          dividendIntelligence: { findMany: async () => [] },
          dividendSustainabilityScore: { findMany: async () => [] },
        },
      }),
    );

    const res = await fetch(`${baseUrl}/api/export/signals?userId=demo-user&format=csv`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    const disposition = res.headers.get("content-disposition") ?? "";
    assert.match(disposition, /^attachment; filename="signals-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.match(body, /^Date,Ticker,Setup,Score,Entry,SL,TP,Result/m);
    assert.match(body, /AAPL,breakout,82,185.2,179.9,194.3,3.4%/);
    assert.ok(capturedWhere, "where filter should be passed");
    assert.equal(typeof (capturedWhere as Record<string, unknown>).created_at, "object");
  });

  it("GET /api/export/portfolio returns CSV rows for paper trades", async () => {
    await startWithRouter(
      createExportRouter({
        db: {
          signal: { findMany: async () => [] },
          paperTrade: {
            findMany: async () => [
              {
                entryAt: new Date("2026-05-01T08:00:00.000Z"),
                exitAt: new Date("2026-05-02T10:30:00.000Z"),
                ticker: "MSFT",
                entryPrice: 420,
                exitPrice: 432,
                pnl: 120,
                pnlPct: 2.86,
                marketRegime: "bull",
              },
            ],
          },
          watchlist: { findMany: async () => [] },
          company: { findMany: async () => [] },
          dividend: { findMany: async () => [] },
          dividendIntelligence: { findMany: async () => [] },
          dividendSustainabilityScore: { findMany: async () => [] },
        },
      }),
    );

    const res = await fetch(`${baseUrl}/api/export/portfolio?userId=demo-user&format=csv`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /^Date,Ticker,Entry,Exit,PnL,PnL%,Duration,Notes/m);
    assert.match(body, /MSFT,420,432,120,2.86%/);
    assert.match(body, /bull/);
  });

  it("GET /api/export/dividend returns watchlist dividend CSV", async () => {
    await startWithRouter(
      createExportRouter({
        db: {
          signal: { findMany: async () => [] },
          paperTrade: { findMany: async () => [] },
          watchlist: {
            findMany: async () => [{ symbol: "KO" }],
          },
          company: {
            findMany: async () => [{ symbol: "KO", name: "Coca-Cola Co." }],
          },
          dividend: {
            findMany: async () => [
              { symbol: "KO", exDate: new Date("2026-06-15T00:00:00.000Z"), amount: 0.51, yield: 2.95 },
            ],
          },
          dividendIntelligence: {
            findMany: async () => [{ symbol: "KO", safetyScore: 84 }],
          },
          dividendSustainabilityScore: {
            findMany: async () => [],
          },
        },
      }),
    );

    const res = await fetch(`${baseUrl}/api/export/dividend?userId=demo-user&format=csv`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /^Ticker,Name,Yield,HealthScore,ExDate,DividendPerShare/m);
    assert.match(body, /KO,Coca-Cola Co\.,2.95%,84,2026-06-15,0.51/);
  });

  it("returns 400 when format is not csv", async () => {
    await startWithRouter(createExportRouter());
    const res = await fetch(`${baseUrl}/api/export/signals?userId=demo-user&format=xlsx`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 400);
  });

  it("returns 403 when authenticated user differs from query userId", async () => {
    await startWithRouter(createExportRouter());
    const otherToken = signAuthToken({ sub: "other-user", email: "other@example.com" });
    const res = await fetch(`${baseUrl}/api/export/signals?userId=demo-user&format=csv`, {
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert.equal(res.status, 403);
  });
});
