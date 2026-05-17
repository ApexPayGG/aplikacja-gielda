import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { searchCompaniesOnDemand, type CompanySearchDependencies } from "./companySearchModule";

function createDependencies(
  overrides: Partial<CompanySearchDependencies> = {},
): CompanySearchDependencies {
  return {
    searchDb: async () => [],
    searchEod: async () => [],
    ...overrides,
  };
}

describe("companySearchModule.searchCompaniesOnDemand", () => {
  it("returns DB results without EOD fallback when DB has at least 3 rows", async () => {
    const searchDb = mock.fn(async () => [
      { symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", exchange: "US", sector: "Technology" },
      { symbol: "NVDA", name: "NVIDIA", exchange: "US", sector: "Technology" },
    ]);
    const searchEod = mock.fn(async () => [
      { symbol: "TSLA.US", name: "Tesla", exchange: "US", sector: "Unknown" },
    ]);

    const result = await searchCompaniesOnDemand("a", 8, createDependencies({ searchDb, searchEod }));

    assert.equal(result.length, 3);
    assert.equal(searchDb.mock.calls.length, 1);
    assert.equal(searchEod.mock.calls.length, 0);
  });

  it("falls back to EOD when DB has fewer than 3 rows and fills up to limit", async () => {
    const searchDb = mock.fn(async () => [
      { symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", exchange: "US", sector: "Technology" },
    ]);
    const searchEod = mock.fn(async () => [
      { symbol: "AAPL", name: "Apple Inc.", exchange: "US", sector: "Unknown" },
      { symbol: "TSLA.US", name: "Tesla", exchange: "US", sector: "Unknown" },
      { symbol: "AMZN.US", name: "Amazon", exchange: "US", sector: "Unknown" },
      { symbol: "GOOGL.US", name: "Alphabet", exchange: "US", sector: "Unknown" },
    ]);

    const result = await searchCompaniesOnDemand("a", 4, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, [
      { symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", exchange: "US", sector: "Technology" },
      { symbol: "TSLA.US", name: "Tesla", exchange: "US", sector: "Unknown" },
      { symbol: "AMZN.US", name: "Amazon", exchange: "US", sector: "Unknown" },
    ]);
    assert.equal(searchEod.mock.calls.length, 1);
  });

  it("still triggers fallback lookup when DB < 3 and limit is small", async () => {
    const searchDb = mock.fn(async () => [
      { symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", exchange: "US", sector: "Technology" },
    ]);
    const searchEod = mock.fn(async () => [{ symbol: "TSLA.US", name: "Tesla", exchange: "US", sector: "Unknown" }]);

    const result = await searchCompaniesOnDemand("a", 2, createDependencies({ searchDb, searchEod }));

    assert.equal(result.length, 2);
    assert.equal(searchEod.mock.calls.length, 1);
  });

  it("returns empty array for empty query", async () => {
    const searchDb = mock.fn(async () => [{ symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" }]);
    const searchEod = mock.fn(async () => [{ symbol: "TSLA.US", name: "Tesla", exchange: "US", sector: "Unknown" }]);
    const result = await searchCompaniesOnDemand("   ", 8, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, []);
    assert.equal(searchDb.mock.calls.length, 0);
    assert.equal(searchEod.mock.calls.length, 0);
  });

  it("keeps DB results when EOD fallback fails", async () => {
    const searchDb = mock.fn(async () => [
      { symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" },
    ]);
    const searchEod = mock.fn(async () => {
      throw new Error("EOD unavailable");
    });

    const result = await searchCompaniesOnDemand("a", 8, createDependencies({ searchDb, searchEod }));

    assert.deepEqual(result, [{ symbol: "AAPL", name: "Apple", exchange: "US", sector: "Technology" }]);
    assert.equal(searchEod.mock.calls.length, 1);
  });
});
