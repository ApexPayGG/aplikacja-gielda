import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createPortfolioRouter } from "../portfolio";

describe("portfolio route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  async function get(path: string): Promise<{ status: number; json: any }> {
    const res = await fetch(`${baseUrl}${path}`);
    return { status: res.status, json: await res.json() };
  }

  beforeEach(async () => {
    const app = express();
    app.use(
      createPortfolioRouter({
        db: {
          user: {
            findUnique: async ({ where }: any) => (where.id === "user_123" ? { id: "user_123" } : null),
          },
          portfolioSnapshot: {
            findFirst: async () => ({ benchmark_wig: 80234, benchmark_sp500: 5345 }),
          },
          virtualTrade: {
            findMany: async () => [{ ticker: "AAPL", exchange: "NYSE" }],
          },
        } as never,
        portfolioService: {
          calculatePortfolio: async () => ({
            holdings: {
              AAPL: { qty: 10, avg_price: 150, current_value: 1650 },
            },
            total_value: 10050,
            cash: 8400,
            total_pnl: 150,
            total_pnl_pct: 10,
            realized_pnl: 20,
            unrealized_pnl: 130,
          }),
          getPortfolioHistory: async () => [
            {
              id: "s2",
              userId: "user_123",
              date: new Date("2026-01-03"),
              total_value: 10050,
              cash: 8400,
              holdings: {},
              pnl_daily: 35,
              pnl_total: 150,
              pnl_pct: 10,
              benchmark_wig: 80234,
              benchmark_sp500: 5345,
            },
            {
              id: "s1",
              userId: "user_123",
              date: new Date("2026-01-02"),
              total_value: 10010,
              cash: 8400,
              holdings: {},
              pnl_daily: -10,
              pnl_total: 115,
              pnl_pct: 7.8,
              benchmark_wig: 80100,
              benchmark_sp500: 5320,
            },
          ],
        } as never,
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("GET /api/portfolio/user_123 returns current holdings + history + stats", async () => {
    const res = await get("/api/portfolio/user_123");
    assert.equal(res.status, 200);
    assert.equal(res.json.user_id, "user_123");
    assert.ok(Array.isArray(res.json.current.holdings));
    assert.ok(res.json.current.holdings.length > 0);
    assert.ok(Array.isArray(res.json.history));
    assert.equal(typeof res.json.stats.avg_daily_pnl, "number");
  });

  it("holdings array is populated", async () => {
    const res = await get("/api/portfolio/user_123");
    assert.equal(res.status, 200);
    assert.ok(res.json.current.holdings.length >= 1);
    assert.equal(res.json.current.holdings[0].ticker, "AAPL");
  });

  it("benchmarks are present", async () => {
    const res = await get("/api/portfolio/user_123");
    assert.equal(res.status, 200);
    assert.equal(typeof res.json.benchmarks.wig, "number");
    assert.equal(typeof res.json.benchmarks.sp500, "number");
  });

  it("history is sorted DESC by date", async () => {
    const res = await get("/api/portfolio/user_123");
    assert.equal(res.status, 200);
    const dates = res.json.history.map((h: { date: string }) => h.date);
    for (let i = 1; i < dates.length; i += 1) {
      assert.ok(dates[i - 1] >= dates[i]);
    }
  });

  it("stats are calculated", async () => {
    const res = await get("/api/portfolio/user_123");
    assert.equal(res.status, 200);
    assert.equal(res.json.stats.days_active, 2);
    assert.equal(res.json.stats.best_day_pnl, 35);
    assert.equal(res.json.stats.worst_day_pnl, -10);
    assert.equal(res.json.stats.avg_daily_pnl, 12.5);
  });
});
