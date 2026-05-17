import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { prisma } from "../../db/index";
import { createDividendsRouter } from "../dividends";

describe("dividends screener route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const original = {
    companyFindMany: prisma.company.findMany,
    companyFindUnique: prisma.company.findUnique,
    signalFindMany: prisma.signal.findMany,
    signalFindFirst: prisma.signal.findFirst,
    dividendFindMany: prisma.dividend.findMany,
    dividendHistoryFindMany: prisma.dividendHistory.findMany,
    dividendIntelligenceFindMany: prisma.dividendIntelligence.findMany,
    dividendIntelligenceFindUnique: prisma.dividendIntelligence.findUnique,
    sustainabilityFindMany: prisma.dividendSustainabilityScore.findMany,
    sustainabilityFindUnique: prisma.dividendSustainabilityScore.findUnique,
    fundamentalFindMany: prisma.fundamental.findMany,
  };

  async function get(path: string): Promise<{ status: number; json: any }> {
    const res = await fetch(`${baseUrl}${path}`);
    return { status: res.status, json: await res.json() };
  }

  beforeEach(async () => {
    (prisma.company.findMany as any) = async () => [
      { symbol: "AAA", sector: "Finance", logoUrl: "logo-aaa" },
      { symbol: "BBB", sector: "Tech", logoUrl: "logo-bbb" },
      { symbol: "CCC", sector: "Finance", logoUrl: "logo-ccc" },
    ];
    (prisma.company.findUnique as any) = async ({ where }: { where: { symbol: string } }) => {
      if (where.symbol === "AAPL") {
        return { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", logoUrl: "apple-logo" };
      }
      return null;
    };
    (prisma.signal.findMany as any) = async () => [
      { ticker: "AAA", exchange: "GPW", score: 91, created_at: new Date("2026-01-02") },
      { ticker: "BBB", exchange: "NYSE", score: 78, created_at: new Date("2026-01-02") },
      { ticker: "CCC", exchange: "GPW", score: 84, created_at: new Date("2026-01-02") },
    ];
    (prisma.signal.findFirst as any) = async () => ({ exchange: "NASDAQ", score: 88 });
    (prisma.dividend.findMany as any) = async (args?: { where?: { symbol?: string } }) => {
      if (args?.where?.symbol === "AAPL") {
        return [
          { exDate: new Date("2027-03-15"), payDate: new Date("2027-03-29"), amount: 1.1, yield: 3.4 },
          { exDate: new Date("2026-03-15"), payDate: new Date("2026-03-29"), amount: 1.0, yield: 3.2 },
          { exDate: new Date("2025-03-15"), payDate: new Date("2025-03-29"), amount: 0.95, yield: 3.0 },
          { exDate: new Date("2024-03-15"), payDate: new Date("2024-03-29"), amount: 0.9, yield: 2.8 },
          { exDate: new Date("2023-03-15"), payDate: new Date("2023-03-29"), amount: 0.85, yield: 2.7 },
          { exDate: new Date("2022-03-15"), payDate: new Date("2022-03-29"), amount: 0.8, yield: 2.5 },
          { exDate: new Date("2021-03-15"), payDate: new Date("2021-03-29"), amount: 0.75, yield: 2.3 },
        ];
      }
      return [
        { symbol: "AAA", yield: 6.1 },
        { symbol: "BBB", yield: 2.2 },
        { symbol: "CCC", yield: 4.5 },
      ];
    };
    (prisma.dividendHistory.findMany as any) = async () => [
      { symbol: "AAA", year: 2019, cagr5Y: 8.2 },
      { symbol: "AAA", year: 2020, cagr5Y: 8.2 },
      { symbol: "AAA", year: 2021, cagr5Y: 8.2 },
      { symbol: "AAA", year: 2022, cagr5Y: 8.2 },
      { symbol: "AAA", year: 2023, cagr5Y: 8.2 },
      { symbol: "AAA", year: 2024, cagr5Y: 8.2 },
      { symbol: "BBB", year: 2022, cagr5Y: 2.1 },
      { symbol: "BBB", year: 2023, cagr5Y: 2.1 },
      { symbol: "BBB", year: 2024, cagr5Y: 2.1 },
      { symbol: "CCC", year: 2018, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2019, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2020, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2021, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2022, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2023, cagr5Y: 6.7 },
      { symbol: "CCC", year: 2024, cagr5Y: 6.7 },
    ];
    (prisma.dividendHistory.findMany as any) = async (args?: { where?: { symbol?: string } }) => {
      if (args?.where?.symbol === "AAPL") {
        return [
          { year: 2026, totalAmount: 1.1, cagr5Y: 9.1 },
          { year: 2025, totalAmount: 1.0, cagr5Y: 8.8 },
          { year: 2024, totalAmount: 0.95, cagr5Y: 8.3 },
          { year: 2023, totalAmount: 0.9, cagr5Y: 7.9 },
          { year: 2022, totalAmount: 0.82, cagr5Y: 7.4 },
          { year: 2021, totalAmount: 0.76, cagr5Y: 7.0 },
          { year: 2020, totalAmount: 0.72, cagr5Y: 6.7 },
        ];
      }
      return [
        { symbol: "AAA", year: 2019, cagr5Y: 8.2 },
        { symbol: "AAA", year: 2020, cagr5Y: 8.2 },
        { symbol: "AAA", year: 2021, cagr5Y: 8.2 },
        { symbol: "AAA", year: 2022, cagr5Y: 8.2 },
        { symbol: "AAA", year: 2023, cagr5Y: 8.2 },
        { symbol: "AAA", year: 2024, cagr5Y: 8.2 },
        { symbol: "BBB", year: 2022, cagr5Y: 2.1 },
        { symbol: "BBB", year: 2023, cagr5Y: 2.1 },
        { symbol: "BBB", year: 2024, cagr5Y: 2.1 },
        { symbol: "CCC", year: 2018, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2019, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2020, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2021, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2022, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2023, cagr5Y: 6.7 },
        { symbol: "CCC", year: 2024, cagr5Y: 6.7 },
      ];
    };
    (prisma.dividendIntelligence.findMany as any) = async () => [
      { symbol: "AAA", trendDirection: "up" },
      { symbol: "BBB", trendDirection: "stable" },
      { symbol: "CCC", trendDirection: "up" },
    ];
    (prisma.dividendIntelligence.findUnique as any) = async () => ({
      trendDirection: "up",
      safetyReason: "Stable free cash flow and conservative payout.",
    });
    (prisma.dividendSustainabilityScore.findMany as any) = async () => [
      { symbol: "AAA", payoutRatio: 55 },
      { symbol: "BBB", payoutRatio: 72 },
      { symbol: "CCC", payoutRatio: 61 },
    ];
    (prisma.dividendSustainabilityScore.findUnique as any) = async () => ({ payoutRatio: 54 });
    (prisma.fundamental.findMany as any) = async () => [
      { metric: "eps_ttm", value: 6 },
      { metric: "fcf", value: 100_000_000_000 },
    ];

    const app = express();
    app.use(createDividendsRouter());
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    (prisma.company.findMany as any) = original.companyFindMany;
    (prisma.company.findUnique as any) = original.companyFindUnique;
    (prisma.signal.findMany as any) = original.signalFindMany;
    (prisma.signal.findFirst as any) = original.signalFindFirst;
    (prisma.dividend.findMany as any) = original.dividendFindMany;
    (prisma.dividendHistory.findMany as any) = original.dividendHistoryFindMany;
    (prisma.dividendIntelligence.findMany as any) = original.dividendIntelligenceFindMany;
    (prisma.dividendIntelligence.findUnique as any) = original.dividendIntelligenceFindUnique;
    (prisma.dividendSustainabilityScore.findMany as any) = original.sustainabilityFindMany;
    (prisma.dividendSustainabilityScore.findUnique as any) = original.sustainabilityFindUnique;
    (prisma.fundamental.findMany as any) = original.fundamentalFindMany;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("1) filters by dy_min and years_min", async () => {
    const res = await get("/api/dividends/screener?dy_min=3&years_min=5");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.results));
    assert.ok(res.json.results.length > 0);
    for (const row of res.json.results) {
      assert.ok(row.dy >= 3);
      assert.ok(row.years_consecutive >= 5);
      assert.ok("ticker" in row && "dy" in row && "years_consecutive" in row && "score" in row);
    }
  });

  it("2) sorts by yield DESC", async () => {
    const res = await get("/api/dividends/screener?sort_by=yield");
    assert.equal(res.status, 200);
    if (res.json.results.length >= 2) {
      assert.ok(res.json.results[0].dy >= res.json.results[1].dy);
    }
  });

  it("3) sorts by score DESC (default score behavior)", async () => {
    const res = await get("/api/dividends/screener?sort_by=score");
    assert.equal(res.status, 200);
    if (res.json.results.length >= 2) {
      assert.ok((res.json.results[0].score ?? -Infinity) >= (res.json.results[1].score ?? -Infinity));
    }
  });

  it("4) filters by trend=rising", async () => {
    const res = await get("/api/dividends/screener?trend=rising");
    assert.equal(res.status, 200);
    for (const row of res.json.results) {
      assert.equal(row.trend, "rising");
    }
  });

  it("5) filters by exchange=GPW", async () => {
    const res = await get("/api/dividends/screener?exchange=GPW");
    assert.equal(res.status, 200);
    for (const row of res.json.results) {
      assert.equal(row.exchange, "GPW");
    }
  });

  it("6) filters by sector=Finance", async () => {
    const res = await get("/api/dividends/screener?sector=Finance");
    assert.equal(res.status, 200);
    for (const row of res.json.results) {
      assert.equal(row.sector, "Finance");
    }
  });

  it("7) no filters returns top <= 50 by default", async () => {
    const res = await get("/api/dividends/screener");
    assert.equal(res.status, 200);
    assert.ok(res.json.count <= 50);
    assert.ok(Array.isArray(res.json.results));
  });

  it("8) invalid sort_by returns 400", async () => {
    const res = await get("/api/dividends/screener?sort_by=invalid");
    assert.equal(res.status, 400);
    assert.match(String(res.json.error), /Invalid sort_by/);
  });

  it("9) invalid number returns 400", async () => {
    const res = await get("/api/dividends/screener?dy_min=abc");
    assert.equal(res.status, 400);
  });

  it("10) response structure includes results, count, filters", async () => {
    const res = await get("/api/dividends/screener?dy_min=3");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.results));
    assert.equal(typeof res.json.count, "number");
    assert.equal(typeof res.json.filters, "object");
  });

  it("GET /api/dividends/AAPL returns full profile with history + score", async () => {
    const res = await get("/api/dividends/AAPL");
    assert.equal(res.status, 200);
    assert.equal(res.json.ticker, "AAPL");
    assert.equal(typeof res.json.health_score, "number");
    assert.ok(Array.isArray(res.json.history));
    assert.ok(res.json.history.length >= 7);
    assert.ok(res.json.company && res.json.dividend && res.json.health_breakdown);
  });

  it("profile history array is sorted DESC by year", async () => {
    const res = await get("/api/dividends/AAPL");
    assert.equal(res.status, 200);
    const years = res.json.history.map((h: { year: number }) => h.year);
    for (let i = 1; i < years.length; i += 1) {
      assert.ok(years[i - 1] >= years[i]);
    }
  });

  it("profile next_ex_date is in the future", async () => {
    const res = await get("/api/dividends/AAPL");
    assert.equal(res.status, 200);
    assert.ok(res.json.next_ex_date, "next_ex_date should be present");
    assert.ok(new Date(res.json.next_ex_date).getTime() > Date.now());
  });

  it("profile health_score is in range 0-100", async () => {
    const res = await get("/api/dividends/AAPL");
    assert.equal(res.status, 200);
    assert.ok(res.json.health_score >= 0 && res.json.health_score <= 100);
  });
});
