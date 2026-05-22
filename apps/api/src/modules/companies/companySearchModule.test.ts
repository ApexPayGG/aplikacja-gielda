import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  mapDbRowsToSearch,
  mapEodSearchRow,
  searchCompaniesOnDemand,
  type CompanySearchDependencies,
  type CompanySearchResultItem,
} from "./companySearchModule";

function createDependencies(
  overrides: Partial<CompanySearchDependencies> = {},
): CompanySearchDependencies {
  return {
    searchDb: async () => [],
    searchEod: async () => [],
    ...overrides,
  };
}

const item = (
  partial: Partial<CompanySearchResultItem> & Pick<CompanySearchResultItem, "symbol" | "name">,
): CompanySearchResultItem => ({
  exchange: "US",
  sector: "Technology",
  logoUrl: null,
  ...partial,
});

describe("companySearchModule mappers", () => {
  it("mapDbRowsToSearch returns logoUrl from DB row", () => {
    const mapped = mapDbRowsToSearch([
      {
        symbol: "AAPL.US",
        name: "Apple Inc.",
        sector: "Technology",
        industry: "Consumer Electronics",
        logoUrl: "https://eodhd.com/img/aapl.png",
        description: "Exchange=US",
        webUrl: null,
        createdAt: new Date(),
      },
    ] as never);

    assert.equal(mapped.length, 1);
    assert.equal(mapped[0]?.logoUrl, "https://eodhd.com/img/aapl.png");
    assert.equal(mapped[0]?.sector, "Technology");
  });

  it("mapDbRowsToSearch sets logoUrl null when missing in DB", () => {
    const mapped = mapDbRowsToSearch([
      {
        symbol: "MSFT.US",
        name: "Microsoft",
        sector: "Technology",
        industry: "Software",
        logoUrl: null,
        description: null,
        webUrl: null,
        createdAt: new Date(),
      },
    ] as never);

    assert.equal(mapped[0]?.logoUrl, null);
  });

  it("mapEodSearchRow sets logoUrl null when EOD payload has no logo", () => {
    const mapped = mapEodSearchRow({ Code: "AAPL", Exchange: "US", Name: "Apple Inc." });
    assert.ok(mapped);
    assert.equal(mapped.logoUrl, null);
    assert.equal(mapped.sector, "Unknown");
  });

  it("mapEodSearchRow normalizes logo URL when EOD provides LogoURL", () => {
    const mapped = mapEodSearchRow({
      Code: "AAPL",
      Exchange: "US",
      Name: "Apple Inc.",
      LogoURL: "/img/logos/US/aapl.png",
    });
    assert.ok(mapped);
    assert.equal(mapped.logoUrl, "https://eodhd.com/img/logos/US/aapl.png");
  });
});

describe("companySearchModule.searchCompaniesOnDemand", () => {
  it("returns DB results without EOD fallback when DB has at least 3 rows", async () => {
    const searchDb = mock.fn(async () => [
      item({ symbol: "AAPL", name: "Apple", logoUrl: "https://cdn.example/aapl.png" }),
      item({ symbol: "MSFT", name: "Microsoft" }),
      item({ symbol: "NVDA", name: "NVIDIA" }),
    ]);
    const searchEod = mock.fn(async () => [
      item({ symbol: "TSLA.US", name: "Tesla", sector: "Unknown" }),
    ]);

    const result = await searchCompaniesOnDemand("a", 8, createDependencies({ searchDb, searchEod }));

    assert.equal(result.length, 3);
    assert.equal(result[0]?.logoUrl, "https://cdn.example/aapl.png");
    assert.equal(searchDb.mock.calls.length, 1);
    assert.equal(searchEod.mock.calls.length, 0);
  });

  it("falls back to EOD when DB has fewer than 3 rows and fills up to limit", async () => {
    const searchDb = mock.fn(async () => [
      item({ symbol: "AAPL", name: "Apple", logoUrl: "https://cdn.example/aapl.png" }),
      item({ symbol: "MSFT", name: "Microsoft" }),
    ]);
    const searchEod = mock.fn(async () => [
      item({ symbol: "AAPL", name: "Apple Inc.", sector: "Unknown", logoUrl: null }),
      item({ symbol: "TSLA.US", name: "Tesla", sector: "Unknown", logoUrl: null }),
      item({ symbol: "AMZN.US", name: "Amazon", sector: "Unknown", logoUrl: null }),
      item({ symbol: "GOOGL.US", name: "Alphabet", sector: "Unknown", logoUrl: null }),
    ]);

    const result = await searchCompaniesOnDemand("a", 4, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, [
      item({ symbol: "AAPL", name: "Apple", logoUrl: "https://cdn.example/aapl.png" }),
      item({ symbol: "MSFT", name: "Microsoft" }),
      item({ symbol: "TSLA.US", name: "Tesla", sector: "Unknown", logoUrl: null }),
      item({ symbol: "AMZN.US", name: "Amazon", sector: "Unknown", logoUrl: null }),
    ]);
    assert.equal(searchEod.mock.calls.length, 1);
  });

  it("still triggers fallback lookup when DB < 3 and limit is small", async () => {
    const searchDb = mock.fn(async () => [
      item({ symbol: "AAPL", name: "Apple" }),
      item({ symbol: "MSFT", name: "Microsoft" }),
    ]);
    const searchEod = mock.fn(async () => [item({ symbol: "TSLA.US", name: "Tesla", sector: "Unknown" })]);

    const result = await searchCompaniesOnDemand("a", 2, createDependencies({ searchDb, searchEod }));

    assert.equal(result.length, 2);
    assert.equal(searchEod.mock.calls.length, 1);
  });

  it("returns empty array for empty query", async () => {
    const searchDb = mock.fn(async () => [item({ symbol: "AAPL", name: "Apple" })]);
    const searchEod = mock.fn(async () => [item({ symbol: "TSLA.US", name: "Tesla", sector: "Unknown" })]);
    const result = await searchCompaniesOnDemand("   ", 8, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, []);
    assert.equal(searchDb.mock.calls.length, 0);
    assert.equal(searchEod.mock.calls.length, 0);
  });

  it("keeps DB results when EOD fallback fails", async () => {
    const searchDb = mock.fn(async () => [item({ symbol: "AAPL", name: "Apple", logoUrl: "https://x/logo.png" })]);
    const searchEod = mock.fn(async () => {
      throw new Error("EOD unavailable");
    });

    const result = await searchCompaniesOnDemand("a", 8, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, [item({ symbol: "AAPL", name: "Apple", logoUrl: "https://x/logo.png" })]);
    assert.equal(searchEod.mock.calls.length, 1);
  });
});
