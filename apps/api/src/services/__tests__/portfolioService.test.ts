import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PortfolioService } from "../portfolioService";

describe("PortfolioService", () => {
  it("create trade (BUY 10 AAPL @ 150)", async () => {
    const created: any[] = [];
    const svc = new PortfolioService({
      db: {
        virtualTrade: {
          create: async ({ data }: any) => {
            const row = { id: "t1", executed_at: new Date(), ...data };
            created.push(row);
            return row;
          },
          findMany: async () => [],
        },
        portfolioSnapshot: {
          create: async ({ data }: any) => ({ id: "s1", date: new Date(), ...data }),
          findMany: async () => [],
        },
        quote: {
          findFirst: async () => null,
        },
      } as never,
      redis: { get: async () => null } as never,
    });

    const trade = await svc.createVirtualTrade({
      userId: "u1",
      ticker: "aapl",
      exchange: "nasdaq",
      side: "BUY",
      quantity: 10,
      price: 150,
    });

    assert.equal(trade.ticker, "AAPL");
    assert.equal(trade.exchange, "NASDAQ");
    assert.equal(created.length, 1);
  });

  it("calculate portfolio (qty=10, avg_price=150)", async () => {
    const svc = new PortfolioService({
      db: {
        virtualTrade: {
          findMany: async () => [
            {
              id: "t1",
              userId: "u1",
              ticker: "AAPL",
              exchange: "NASDAQ",
              side: "BUY",
              quantity: 10,
              price: 150,
              executed_at: new Date("2026-01-01"),
              signal_id: null,
              notes: null,
              pnl_amount: null,
              pnl_pct: null,
            },
          ],
          create: async ({ data }: any) => ({ id: "x", executed_at: new Date(), ...data }),
        },
        portfolioSnapshot: {
          create: async ({ data }: any) => ({ id: "s1", date: new Date(), ...data }),
          findMany: async () => [],
        },
        quote: {
          findFirst: async () => ({ close: 149 }),
        },
      } as never,
      redis: {
        get: async (key: string) => {
          if (key.includes(":AAPL")) return JSON.stringify({ close: 150 });
          return null;
        },
      } as never,
    });

    const p = await svc.calculatePortfolio("u1");
    assert.equal(p.holdings.AAPL?.qty, 10);
    assert.equal(p.holdings.AAPL?.avg_price, 150);
  });

  it("take snapshot creates record", async () => {
    const snapshots: any[] = [];
    const svc = new PortfolioService({
      db: {
        virtualTrade: {
          findMany: async () => [
            {
              id: "t1",
              userId: "u1",
              ticker: "AAPL",
              exchange: "NASDAQ",
              side: "BUY",
              quantity: 10,
              price: 150,
              executed_at: new Date("2026-01-01"),
              signal_id: null,
              notes: null,
              pnl_amount: null,
              pnl_pct: null,
            },
          ],
          create: async ({ data }: any) => ({ id: "x", executed_at: new Date(), ...data }),
        },
        portfolioSnapshot: {
          create: async ({ data }: any) => {
            const row = { id: "s1", date: new Date(), ...data };
            snapshots.push(row);
            return row;
          },
          findMany: async () => snapshots,
        },
        quote: {
          findFirst: async ({ where }: any) => (where.symbol === "AAPL" ? { close: 155 } : { close: 0 }),
        },
      } as never,
      redis: {
        get: async (key: string) => {
          if (key.includes(":AAPL")) return JSON.stringify({ close: 155 });
          if (key.includes(":WIG")) return JSON.stringify({ close: 80000 });
          if (key.includes(":SP500")) return JSON.stringify({ close: 5400 });
          return null;
        },
      } as never,
    });

    const snap = await svc.takeSnapshot("u1");
    assert.equal(snap.userId, "u1");
    assert.equal(snapshots.length, 1);
  });

  it("get history returns snapshots DESC", async () => {
    const svc = new PortfolioService({
      db: {
        virtualTrade: {
          findMany: async () => [],
          create: async ({ data }: any) => ({ id: "x", executed_at: new Date(), ...data }),
        },
        portfolioSnapshot: {
          create: async ({ data }: any) => ({ id: "s1", date: new Date(), ...data }),
          findMany: async () => [
            { id: "s2", userId: "u1", date: new Date("2026-01-02") },
            { id: "s1", userId: "u1", date: new Date("2026-01-01") },
          ],
        },
        quote: {
          findFirst: async () => null,
        },
      } as never,
      redis: { get: async () => null } as never,
    });

    const history = await svc.getPortfolioHistory("u1", 30);
    assert.equal(history.length, 2);
    assert.ok((history[0] as any).date >= (history[1] as any).date);
  });
});
