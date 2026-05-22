import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  finalizeSearchResults,
  mapDbRowsToSearch,
  mapEodSearchRow,
  mergeSearchResultItems,
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

const candidate = (
  partial: Partial<CompanySearchResultItem> & Pick<CompanySearchResultItem, "symbol" | "name">,
  source: "db" | "eod",
) => ({ ...item(partial), source });

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

describe("companySearchModule merge and finalize", () => {
  const tslaLogo = "https://eodhd.com/img/logos/US/TSLA.png";

  it("mergeSearchResultItems keeps logoUrl when EOD row is merged after DB row", () => {
    const merged = mergeSearchResultItems(
      candidate(
        {
          symbol: "TSLA",
          name: "Tesla Inc",
          sector: "Consumer Discretionary",
          logoUrl: tslaLogo,
        },
        "db",
      ),
      candidate({ symbol: "TSLA", name: "Tesla Inc", sector: "Unknown", logoUrl: null }, "eod"),
    );

    assert.equal(merged.logoUrl, tslaLogo);
    assert.equal(merged.sector, "Consumer Discretionary");
  });

  it("mergeSearchResultItems keeps logoUrl when DB row is merged after EOD row", () => {
    const merged = mergeSearchResultItems(
      candidate({ symbol: "TSLA", name: "Tesla Inc", sector: "Unknown", logoUrl: null }, "eod"),
      candidate(
        {
          symbol: "TSLA",
          name: "Tesla Inc",
          sector: "Consumer Discretionary",
          logoUrl: tslaLogo,
        },
        "db",
      ),
    );

    assert.equal(merged.logoUrl, tslaLogo);
    assert.equal(merged.sector, "Consumer Discretionary");
  });

  it("finalizeSearchResults preserves TSLA logo when TSLA.US shares the same logo", () => {
    const results = finalizeSearchResults(
      "TSLA",
      [
        candidate(
          {
            symbol: "TSLA",
            name: "Tesla Inc",
            sector: "Consumer Discretionary",
            logoUrl: tslaLogo,
          },
          "db",
        ),
        candidate(
          {
            symbol: "TSLA.US",
            name: "Tesla Inc",
            sector: "Unknown",
            logoUrl: tslaLogo,
          },
          "eod",
        ),
      ],
      3,
    );

    const tsla = results.find((r) => r.symbol === "TSLA");
    assert.equal(tsla?.logoUrl, tslaLogo);
    assert.equal(results[0]?.symbol, "TSLA");
  });

  for (const [symbol, name, logoUrl, sector] of [
    ["XOM", "Exxon Mobil Corporation", "https://eodhd.com/img/logos/US/XOM.png", "Energy"],
    ["CVX", "Chevron Corporation", "https://eodhd.com/img/logos/US/cvx.png", "Energy"],
    ["PG", "Procter & Gamble Company", "https://eodhd.com/img/logos/US/PG.png", "Consumer Staples"],
  ] as const) {
    it(`${symbol} exact match keeps DB logoUrl through EOD merge`, () => {
      const results = finalizeSearchResults(
        symbol,
        [
          candidate({ symbol, name, sector, logoUrl }, "db"),
          candidate({ symbol, name, sector: "Unknown", logoUrl: null }, "eod"),
        ],
        3,
      );

      assert.equal(results[0]?.symbol, symbol);
      assert.equal(results[0]?.logoUrl, logoUrl);
    });
  }
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

  it("TSLA exact search keeps logoUrl from DB over EOD null for same symbol", async () => {
    const tslaLogo = "https://eodhd.com/img/logos/US/TSLA.png";
    const searchDb = mock.fn(async () => [
      item({
        symbol: "TSLA",
        name: "Tesla Inc",
        sector: "Consumer Discretionary",
        logoUrl: tslaLogo,
      }),
    ]);
    const searchEod = mock.fn(async () => [
      item({ symbol: "TSLA", name: "Tesla Inc", sector: "Unknown", logoUrl: null }),
      item({ symbol: "TSLA.US", name: "Tesla Inc", sector: "Unknown", logoUrl: null }),
      item({ symbol: "TSM.US", name: "Taiwan Semiconductor", sector: "Unknown", logoUrl: null }),
    ]);

    const result = await searchCompaniesOnDemand("TSLA", 3, createDependencies({ searchDb, searchEod }));

    assert.equal(result[0]?.symbol, "TSLA");
    assert.equal(result[0]?.logoUrl, tslaLogo);
    assert.equal(searchEod.mock.calls.length, 1);
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
