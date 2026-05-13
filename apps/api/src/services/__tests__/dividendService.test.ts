import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { prisma } from "../../db";
import { searchGrowthScreener } from "../dividendService";

describe("dividendService.searchGrowthScreener", () => {
  const original = {
    dividendHistoryFindMany: prisma.dividendHistory.findMany,
    dividendFindMany: prisma.dividend.findMany,
    quoteFindMany: prisma.quote.findMany,
  };

  beforeEach(() => {
    (prisma.dividendHistory.findMany as any) = async () => [];
    (prisma.dividend.findMany as any) = async () => [];
    (prisma.quote.findMany as any) = async () => [];
  });

  afterEach(() => {
    (prisma.dividendHistory.findMany as any) = original.dividendHistoryFindMany;
    (prisma.dividend.findMany as any) = original.dividendFindMany;
    (prisma.quote.findMany as any) = original.quoteFindMany;
  });

  it("returns null YoY/CAGR when previous-year history is missing", async () => {
    (prisma.dividendHistory.findMany as any) = async () => [
      { symbol: "AAA", year: 2026, totalAmount: 5, growthYoY: -48, cagr5Y: -48, cagr10Y: null },
    ];
    (prisma.dividend.findMany as any) = async () => [{ symbol: "AAA", yield: 99 }];
    (prisma.quote.findMany as any) = async () => [{ symbol: "AAA", close: 100 }];

    const res = await searchGrowthScreener({
      minYears: 1,
      minYield: 0,
      limit: 50,
      offset: 0,
      includeDebug: true,
    });

    assert.equal(res.items.length, 1);
    assert.equal(res.items[0]?.symbol, "AAA");
    assert.equal(res.items[0]?.growthYoY, null);
    assert.equal(res.items[0]?.cagr5Y, null);
    assert.equal(res.items[0]?.latestYield, 5);
  });

  it("computes YoY from latest two annual dividends and CAGR5Y from 5 years", async () => {
    (prisma.dividendHistory.findMany as any) = async () => [
      { symbol: "BBB", year: 2022, totalAmount: 1.0, growthYoY: null, cagr5Y: null, cagr10Y: null },
      { symbol: "BBB", year: 2023, totalAmount: 1.1, growthYoY: null, cagr5Y: null, cagr10Y: null },
      { symbol: "BBB", year: 2024, totalAmount: 1.2, growthYoY: null, cagr5Y: null, cagr10Y: null },
      { symbol: "BBB", year: 2025, totalAmount: 1.3, growthYoY: null, cagr5Y: null, cagr10Y: null },
      { symbol: "BBB", year: 2026, totalAmount: 1.4, growthYoY: null, cagr5Y: null, cagr10Y: null },
    ];
    (prisma.dividend.findMany as any) = async () => [{ symbol: "BBB", yield: 1 }];
    (prisma.quote.findMany as any) = async () => [{ symbol: "BBB", close: 28 }];

    const res = await searchGrowthScreener({
      minYears: 1,
      minYield: 0,
      limit: 50,
      offset: 0,
      includeDebug: true,
    });

    assert.equal(res.items.length, 1);
    const row = res.items[0];
    assert.ok(row);
    assert.equal(Number(row.growthYoY?.toFixed(2)), 7.69);
    assert.equal(Number(row.latestYield?.toFixed(2)), 5.0);
    assert.equal(Number(row.cagr5Y?.toFixed(2)), 8.78);
  });
});
