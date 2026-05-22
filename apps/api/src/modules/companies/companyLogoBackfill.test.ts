import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  formatBackfillVerboseLog,
  indexCompaniesWithLogo,
  listUnsafeVariantSkips,
  pickLogoDonorFromVariants,
  runCompanyLogoBackfill,
  type CompanyLogoRow,
} from "./companyLogoBackfill";

function row(partial: CompanyLogoRow): CompanyLogoRow {
  return partial;
}

describe("companyLogoBackfill matching", () => {
  it("AAPL.US can receive logo from AAPL when names match", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "AAPL",
        name: "Apple Inc",
        exchange: "US",
        logoUrl: "https://cdn.example/aapl.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "AAPL.US", name: "Apple Inc", exchange: "US", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.logoUrl, "https://cdn.example/aapl.png");
  });

  it("ALE can receive logo from ALE.WAR when names match", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "ALE.WAR",
        name: "Allegro.eu SA",
        exchange: "WAR",
        logoUrl: "https://cdn.example/ale.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "ALE", name: "Allegro.eu SA", exchange: "WAR", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.symbol, "ALE.WAR");
  });

  it("TSLA and TSLA.US can share logo when names match", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "TSLA",
        name: "Tesla Inc",
        exchange: "US",
        logoUrl: "https://cdn.example/tsla.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "TSLA.US", name: "Tesla Inc", exchange: "US", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.logoUrl, "https://cdn.example/tsla.png");
  });

  it("BDX does not receive logo from BDX.US when names differ", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "BDX.US",
        name: "Becton Dickinson and Co",
        exchange: "US",
        logoUrl: "https://cdn.example/bdx-us.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "BDX", name: "Budimex SA", exchange: "WAR", logoUrl: null }),
      donors,
    );
    assert.ok(result && "skipped" in result);
    assert.equal(result.skipped, "unsafe");
  });

  it("listUnsafeVariantSkips describes BDX vs BDX.US mismatch", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "BDX.US",
        name: "Becton Dickinson and Co",
        exchange: "US",
        logoUrl: "https://cdn.example/bdx-us.png",
      }),
    ]);
    const skips = listUnsafeVariantSkips(
      row({ symbol: "BDX", name: "Budimex SA", exchange: "WAR", logoUrl: null }),
      donors,
    );
    assert.equal(skips.length, 1);
    assert.equal(skips[0]?.donorSymbol, "BDX.US");
    assert.equal(skips[0]?.targetSymbol, "BDX");
  });

  it("different issuer names on same base do not pass", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "PEO.US",
        name: "Peoples Energy Corp",
        exchange: "US",
        logoUrl: "https://cdn.example/peo-us.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "PEO", name: "Bank Pekao SA", exchange: "WAR", logoUrl: null }),
      donors,
    );
    assert.ok(result && "skipped" in result);
  });
});

describe("runCompanyLogoBackfill", () => {
  it("does not overwrite existing logoUrl by default", async () => {
    let savedLogo: string | undefined;
    const update = mock.fn(async (args: { data?: { logoUrl?: string } }) => {
      savedLogo = args.data?.logoUrl;
      return {};
    });
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "AAPL.US", name: "Apple Inc", exchange: "US", logoUrl: null }];
      }
      return [{ symbol: "AAPL", name: "Apple Inc", exchange: "US", logoUrl: "https://cdn.example/aapl.png" }];
    });

    const { summary } = await runCompanyLogoBackfill(
      { limit: 10, dryRun: false },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhdLogo: async () => null,
        fetchFinnhubLogo: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(update.mock.calls.length, 1);
    assert.equal(savedLogo, "https://cdn.example/aapl.png");
    assert.equal(summary.updated, 1);
  });

  it("dryRun does not write to DB", async () => {
    const update = mock.fn(async () => ({}));
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "MSFT", name: "Microsoft Corp", exchange: "US", logoUrl: null }];
      }
      return [];
    });

    const result = await runCompanyLogoBackfill(
      { limit: 5, dryRun: true, verbose: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhdLogo: async () => "https://cdn.example/msft.png",
        fetchFinnhubLogo: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.dryRun, true);
    assert.equal(result.summary.updated, 1);
    assert.equal(result.summary.fetchedFromEodhd, 1);
    assert.equal(update.mock.calls.length, 0);
    assert.equal(result.log.plannedUpdates.length, 1);
    assert.equal(result.log.plannedUpdates[0]?.symbol, "MSFT");
    const verboseText = formatBackfillVerboseLog(result, { dryRun: true });
    assert.match(verboseText, /planned updates/);
    assert.match(verboseText, /symbol: MSFT/);
    assert.match(verboseText, /source: eodhd/);
  });

  it("respects limit", async () => {
    const findMany = mock.fn(async (args: { take?: number; where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        assert.equal(args.take, 2);
        return [
          { symbol: "AAA", name: "AAA Corp", exchange: "US", logoUrl: null },
          { symbol: "BBB", name: "BBB Corp", exchange: "US", logoUrl: null },
        ];
      }
      return [];
    });
    const update = mock.fn(async () => ({}));

    const { summary } = await runCompanyLogoBackfill(
      { limit: 2, dryRun: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhdLogo: async () => null,
        fetchFinnhubLogo: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(summary.scanned, 2);
  });

  it("verbose logs sanitized errors without persisting", async () => {
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "ERR", name: "Error Co", exchange: "US", logoUrl: null }];
      }
      return [];
    });
    const update = mock.fn(async () => ({}));

    const result = await runCompanyLogoBackfill(
      { limit: 1, dryRun: true, verbose: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhdLogo: async () => {
          throw new Error("EODHD fundamentals HTTP 401: api_token=secret123");
        },
        fetchFinnhubLogo: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.errors, 1);
    assert.equal(result.log.errors[0]?.symbol, "ERR");
    assert.match(result.log.errors[0]?.message ?? "", /api_token=\*\*\*/);
    assert.equal(update.mock.calls.length, 0);
  });
});
