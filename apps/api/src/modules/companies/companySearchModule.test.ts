import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  mapDbRowsToSearch,
  mapEodSearchRow,
  rankCompanySearchResults,
  sanitizeCrossSymbolLogos,
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

describe("companySearchModule ranking", () => {
  it("PEP query prefers PEP.US over PCO (Pepco name match)", () => {
    const ranked = rankCompanySearchResults("PEP", [
      item({ symbol: "PCO.WAR", name: "Pepco Group NV", exchange: "WAR", sector: "Consumer" }),
      item({ symbol: "PEP.US", name: "PepsiCo Inc", exchange: "US", logoUrl: "https://cdn.example/pep.png" }),
      item({ symbol: "PEP", name: "PepsiCo Inc", exchange: "US" }),
    ]);

    assert.equal(ranked[0]?.symbol, "PEP");
    assert.equal(ranked[1]?.symbol, "PEP.US");
    assert.ok(ranked.findIndex((r) => r.symbol === "PCO.WAR") > 1);
  });

  it("KO query prefers KO.US over Korean suffix symbol 000660.KO", () => {
    const ranked = rankCompanySearchResults("KO", [
      item({ symbol: "000660.KO", name: "SK Hynix Inc", exchange: "KO", sector: "Technology" }),
      item({ symbol: "KO.US", name: "Coca-Cola Co", exchange: "US", logoUrl: "https://cdn.example/ko.png" }),
      item({ symbol: "KO", name: "Coca-Cola Co", exchange: "US" }),
    ]);

    assert.equal(ranked[0]?.symbol, "KO");
    assert.equal(ranked[1]?.symbol, "KO.US");
    const hynixIdx = ranked.findIndex((r) => r.symbol === "000660.KO");
    assert.ok(hynixIdx >= 2);
  });

  it("BDX does not keep logo copied from BDX.US when names differ", () => {
    const sharedLogo = "https://cdn.example/bdx-us.png";
    const sanitized = sanitizeCrossSymbolLogos([
      item({
        symbol: "BDX",
        name: "Budimex SA",
        exchange: "WAR",
        logoUrl: sharedLogo,
        sector: "Industrials",
      }),
      item({
        symbol: "BDX.US",
        name: "Becton Dickinson and Co",
        exchange: "US",
        logoUrl: sharedLogo,
        sector: "Healthcare",
      }),
    ]);

    const budimex = sanitized.find((r) => r.symbol === "BDX");
    const bd = sanitized.find((r) => r.symbol === "BDX.US");
    assert.equal(budimex?.logoUrl, null);
    assert.equal(bd?.logoUrl, sharedLogo);
  });

  it("BDX query keeps both listings with BDX before BDX.US", () => {
    const ranked = rankCompanySearchResults("BDX", [
      item({ symbol: "BDX.US", name: "Becton Dickinson and Co", exchange: "US" }),
      item({ symbol: "BDX", name: "Budimex SA", exchange: "WAR" }),
    ]);

    assert.equal(ranked[0]?.symbol, "BDX");
    assert.equal(ranked[1]?.symbol, "BDX.US");
    assert.equal(ranked[0]?.exchange, "WAR");
    assert.equal(ranked[1]?.exchange, "US");
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

    const result = await searchCompaniesOnDemand("a", 6, createDependencies({ searchDb, searchEod }));

    assert.equal(result.length, 5);
    assert.equal(searchEod.mock.calls.length, 1);
    const symbols = result.map((r) => r.symbol);
    assert.ok(symbols.includes("AAPL"));
    assert.ok(symbols.includes("MSFT"));
    assert.ok(symbols.includes("TSLA.US"));
    assert.equal(result.find((r) => r.symbol === "AAPL")?.logoUrl, "https://cdn.example/aapl.png");
    const aaplIdx = symbols.indexOf("AAPL");
    const msftIdx = symbols.indexOf("MSFT");
    assert.ok(aaplIdx >= 0 && msftIdx >= 0 && aaplIdx < msftIdx);
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
