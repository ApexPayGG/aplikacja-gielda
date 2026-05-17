import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { prisma } from "../../db/index";
import { createBacktestRouter } from "../backtest";

describe("backtest route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const original = {
    signalFindMany: prisma.signal.findMany,
    quoteFindMany: prisma.quote.findMany,
  };

  async function post(body: unknown): Promise<{ status: number; json: any }> {
    const res = await fetch(`${baseUrl}/api/backtest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  }

  beforeEach(async () => {
    (prisma.signal.findMany as any) = async () => [
      { id: "s1", ticker: "AAPL", created_at: new Date("2024-01-02T00:00:00.000Z") },
      { id: "s2", ticker: "MSFT", created_at: new Date("2024-01-03T00:00:00.000Z") },
    ];
    (prisma.quote.findMany as any) = async ({ where }: any) => {
      const sym = where.symbol;
      if (sym === "AAPL") {
        return [
          { timestamp: new Date("2024-01-02"), close: 100 },
          { timestamp: new Date("2024-01-22"), close: 110 },
        ];
      }
      return [
        { timestamp: new Date("2024-01-03"), close: 200 },
        { timestamp: new Date("2024-01-23"), close: 190 },
      ];
    };

    const app = express();
    app.use(express.json());
    app.use(createBacktestRouter());
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    (prisma.signal.findMany as any) = original.signalFindMany;
    (prisma.quote.findMany as any) = original.quoteFindMany;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("POST /api/backtest returns win_rate, avg_return, equity_curve", async () => {
    const res = await post({ pattern: "breakout", start_date: "2024-01-01" });
    assert.equal(res.status, 200);
    assert.equal(typeof res.json.win_rate, "number");
    assert.equal(typeof res.json.avg_return, "number");
    assert.ok(Array.isArray(res.json.equity_curve));
    assert.ok(Array.isArray(res.json.trades));
    assert.ok(res.json.trades.length > 0);
  });

  it("win_rate is between 0 and 100", async () => {
    const res = await post({ pattern: "breakout", start_date: "2024-01-01" });
    assert.equal(res.status, 200);
    assert.ok(res.json.win_rate >= 0 && res.json.win_rate <= 100);
  });

  it("equity_curve is sorted by date ASC", async () => {
    const res = await post({ pattern: "breakout", start_date: "2024-01-01" });
    assert.equal(res.status, 200);
    const dates = res.json.equity_curve.map((p: { date: string }) => p.date);
    for (let i = 1; i < dates.length; i += 1) {
      assert.ok(dates[i - 1] <= dates[i]);
    }
  });

  it("invalid pattern returns 400", async () => {
    const res = await post({ pattern: "invalid", start_date: "2024-01-01" });
    assert.equal(res.status, 400);
  });
});
