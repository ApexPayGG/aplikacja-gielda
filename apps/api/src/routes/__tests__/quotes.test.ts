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
  let liveLatestRow: {
    id: bigint;
    ticker: string;
    price: Prisma.Decimal;
    open: Prisma.Decimal | null;
    high: Prisma.Decimal | null;
    low: Prisma.Decimal | null;
    close: Prisma.Decimal | null;
    volume: bigint | null;
    vwap: Prisma.Decimal | null;
    createdAt: Date;
    updatedAt: Date;
  } | null = {
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
  };
  let historicalLatestRow: {
    id: bigint;
    symbol: string;
    open: Prisma.Decimal;
    high: Prisma.Decimal;
    low: Prisma.Decimal;
    close: Prisma.Decimal;
    volume: bigint;
    timestamp: Date;
  } | null = null;
  let queryRawResponses: unknown[] = [];

  const findFirst = mock.fn(async () => liveLatestRow);
  const historicalFindFirst = mock.fn(async () => historicalLatestRow);
  const queryRaw = mock.fn(async () => queryRawResponses.shift() ?? []);

  beforeEach(async () => {
    liveLatestRow = {
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
    };
    historicalLatestRow = null;
    queryRawResponses = [
      [
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
      ],
    ];
    const app = express();
    app.use(
      createQuotesRouter({
        db: {
          liveQuote: { findFirst, findMany: mock.fn(async () => []) },
          quote: { findFirst: historicalFindFirst },
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
    assert.equal(res.headers.get("x-ratelimit-limit"), "50");
    assert.match(res.headers.get("x-ratelimit-remaining") ?? "", /^[0-9]+$/);
    assert.match(res.headers.get("x-ratelimit-reset") ?? "", /^[0-9]+$/);
    const body = (await res.json()) as { quote: { ticker: string; price: string } };
    assert.equal(body.quote.ticker, "AAPL");
    assert.equal(body.quote.price, "150.25");
  });

  it("GET /api/quotes/latest stays public with invalid auth header", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/latest?ticker=AAPL`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    assert.equal(res.status, 200);
  });

  it("GET /api/quotes/latest validates ticker", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/latest?ticker=!!`);
    assert.equal(res.status, 400);
  });

  it("GET /api/quotes/latest falls back to historical quote", async () => {
    liveLatestRow = null;
    historicalLatestRow = {
      id: BigInt(10),
      symbol: "AAPL",
      open: new Prisma.Decimal("178.00"),
      high: new Prisma.Decimal("181.00"),
      low: new Prisma.Decimal("177.00"),
      close: new Prisma.Decimal("180.50"),
      volume: BigInt(2500000),
      timestamp: new Date("2026-05-06T00:00:00.000Z"),
    };
    const res = await fetch(`${baseUrl}/api/quotes/latest?ticker=AAPL`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { quote: { ticker: string; price: string; source: string } };
    assert.equal(body.quote.ticker, "AAPL");
    assert.equal(body.quote.price, "180.5");
    assert.equal(body.quote.source, "quotes_fallback");
  });

  it("GET /api/quotes/top returns ranked rows", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/top?limit=5`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number; quotes: Array<{ ticker: string }> };
    assert.equal(body.count, 1);
    assert.equal(body.quotes[0].ticker, "MSFT");
  });

  it("GET /api/quotes/top stays public with invalid auth header", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/top?limit=5`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    assert.equal(res.status, 200);
  });

  it("GET /api/quotes/top falls back to historical quotes when live is empty", async () => {
    queryRawResponses = [
      [],
      [
        {
          id: BigInt(11),
          symbol: "AAPL",
          open: new Prisma.Decimal("178.00"),
          high: new Prisma.Decimal("181.00"),
          low: new Prisma.Decimal("177.00"),
          close: new Prisma.Decimal("180.50"),
          volume: BigInt(2500000),
          timestamp: new Date("2026-05-06T00:00:00.000Z"),
        },
      ],
    ];
    const res = await fetch(`${baseUrl}/api/quotes/top?limit=5`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number; quotes: Array<{ ticker: string; source: string }> };
    assert.equal(body.count, 1);
    assert.equal(body.quotes[0].ticker, "AAPL");
    assert.equal(body.quotes[0].source, "quotes_fallback");
  });

  it("GET /api/quotes/top fallback deduplicates base symbol and prefers ticker without .US", async () => {
    queryRawResponses = [
      [],
      [
        {
          id: BigInt(21),
          symbol: "AAPL.US",
          open: new Prisma.Decimal("180.00"),
          high: new Prisma.Decimal("182.00"),
          low: new Prisma.Decimal("179.00"),
          close: new Prisma.Decimal("181.00"),
          volume: BigInt(2100000),
          timestamp: new Date("2026-05-06T00:00:00.000Z"),
        },
        {
          id: BigInt(22),
          symbol: "AAPL",
          open: new Prisma.Decimal("179.00"),
          high: new Prisma.Decimal("181.00"),
          low: new Prisma.Decimal("178.00"),
          close: new Prisma.Decimal("180.50"),
          volume: BigInt(2000000),
          timestamp: new Date("2026-05-05T00:00:00.000Z"),
        },
        {
          id: BigInt(23),
          symbol: "META.US",
          open: new Prisma.Decimal("500.00"),
          high: new Prisma.Decimal("510.00"),
          low: new Prisma.Decimal("495.00"),
          close: new Prisma.Decimal("507.00"),
          volume: BigInt(1800000),
          timestamp: new Date("2026-05-06T00:00:00.000Z"),
        },
      ],
    ];

    const res = await fetch(`${baseUrl}/api/quotes/top?limit=5`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { quotes: Array<{ ticker: string; internalTicker?: string }> };

    assert.deepEqual(
      body.quotes.map((q) => q.ticker).sort(),
      ["AAPL", "META"],
    );
    const metaQuote = body.quotes.find((q) => q.ticker === "META");
    assert.equal(metaQuote?.internalTicker, "META.US");
  });
});
