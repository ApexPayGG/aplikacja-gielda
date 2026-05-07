import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import express from "express";
import { Prisma } from "@prisma/client";
import { createQuotesRouter } from "../quotes";

class InMemoryRateStore {
  private readonly data = new Map<string, { count: number; expiresAt: number }>();

  async incr(key: string): Promise<number> {
    const now = Date.now();
    const row = this.data.get(key);
    if (!row || row.expiresAt <= now) {
      this.data.set(key, { count: 1, expiresAt: now + 60_000 });
      return 1;
    }
    row.count += 1;
    return row.count;
  }

  async expire(key: string, sec: number): Promise<number> {
    const row = this.data.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + sec * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const row = this.data.get(key);
    if (!row) return -2;
    return Math.max(0, Math.ceil((row.expiresAt - Date.now()) / 1000));
  }
}

describe("quotes routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  const findFirst = mock.fn(async () => ({
    id: BigInt(1),
    ticker: "AAPL",
    price: new Prisma.Decimal("150.25"),
    open: new Prisma.Decimal("149.00"),
    high: new Prisma.Decimal("151.00"),
    low: new Prisma.Decimal("148.50"),
    close: new Prisma.Decimal("150.25"),
    volume: BigInt(1_000_000),
    vwap: new Prisma.Decimal("149.90"),
    createdAt: new Date("2026-05-07T10:00:00.000Z"),
    updatedAt: new Date("2026-05-07T10:00:00.000Z"),
  }));

  const queryRaw = mock.fn(async () => [
    {
      id: BigInt(2),
      ticker: "MSFT",
      price: new Prisma.Decimal("300.00"),
      open: null,
      high: null,
      low: null,
      close: null,
      volume: BigInt(5000),
      vwap: null,
      created_at: new Date("2026-05-07T11:00:00.000Z"),
      updated_at: new Date("2026-05-07T11:00:00.000Z"),
    },
  ]);

  beforeEach(async () => {
    const app = express();
    app.use(
      createQuotesRouter({
        db: {
          liveQuote: { findFirst, findMany: mock.fn(async () => []) },
          $queryRaw: queryRaw,
        } as never,
        rateStore: new InMemoryRateStore() as never,
        getClientIp: () => "test-quotes-ip",
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

  it("GET /api/quotes/latest returns quote", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/latest?ticker=AAPL`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { quote: { ticker: string; price: string } };
    assert.equal(body.quote.ticker, "AAPL");
    assert.equal(body.quote.price, "150.25");
  });

  it("GET /api/quotes/latest validates ticker", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/latest?ticker=!!`);
    assert.equal(res.status, 400);
  });

  it("GET /api/quotes/top returns ranked rows", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/top?limit=5`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number; quotes: Array<{ ticker: string }> };
    assert.equal(body.count, 1);
    assert.equal(body.quotes[0].ticker, "MSFT");
  });
});
