import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  acceptProviderLogoForTarget,
  formatBackfillVerboseLog,
  indexCompaniesWithLogo,
  isLogoUrlExchangeConsistent,
  listUnsafeVariantSkips,
  parseEodhdLogoUrlExchange,
  pickLogoDonorFromVariants,
  runCompanyLogoBackfill,
  type CompanyLogoRow,
  type ProviderLogoCandidate,
} from "./companyLogoBackfill";

function row(partial: CompanyLogoRow): CompanyLogoRow {
  return partial;
}

function provider(partial: ProviderLogoCandidate): ProviderLogoCandidate {
  return partial;
}

describe("logo URL exchange consistency", () => {
  it("parses EODHD logo path exchange segment", () => {
    assert.equal(
      parseEodhdLogoUrlExchange("https://eodhd.com/img/logos/US/mrk.png"),
      "US",
    );
    assert.equal(
      parseEodhdLogoUrlExchange("https://eodhd.com/img/logos/XETRA/SIE.png"),
      "XETRA",
    );
  });

  it("rejects MRK.XETRA donor with US path for MRK DAX target", () => {
    const target = row({ symbol: "MRK", name: "Merck KGaA", exchange: "DAX", logoUrl: null });
    const donor = row({
      symbol: "MRK.XETRA",
      name: "Merck KGaA",
      exchange: "XETRA",
      logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
    });
    assert.equal(isLogoUrlExchangeConsistent(donor.logoUrl!, donor, target), false);
  });

  it("accepts DAX target with XETRA donor and XETRA EODHD path", () => {
    const target = row({ symbol: "SIE", name: "Siemens AG", exchange: "DAX", logoUrl: null });
    const donor = row({
      symbol: "SIE.XETRA",
      name: "Siemens AG",
      exchange: "XETRA",
      logoUrl: "https://eodhd.com/img/logos/XETRA/SIE.png",
    });
    assert.equal(isLogoUrlExchangeConsistent(donor.logoUrl!, donor, target), true);
  });

  it("accepts Finnhub logo without exchange path when names match", () => {
    const target = row({ symbol: "AAPL.US", name: "Apple Inc", exchange: "US", logoUrl: null });
    const donor = row({
      symbol: "AAPL",
      name: "Apple Inc",
      exchange: "US",
      logoUrl: "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png",
    });
    assert.equal(isLogoUrlExchangeConsistent(donor.logoUrl!, donor, target), true);
  });
});

describe("companyLogoBackfill matching", () => {
  it("AAPL.US can receive logo from AAPL with Finnhub URL when names match", () => {
    const finnhubLogo =
      "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png";
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "AAPL",
        name: "Apple Inc",
        exchange: "US",
        logoUrl: finnhubLogo,
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "AAPL.US", name: "Apple Inc", exchange: "US", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.logoUrl, finnhubLogo);
  });

  it("MSFT.US can receive logo from MSFT with Finnhub URL when names match", () => {
    const finnhubLogo =
      "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png";
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "MSFT",
        name: "Microsoft Corp",
        exchange: "US",
        logoUrl: finnhubLogo,
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "MSFT.US", name: "Microsoft Corp", exchange: "US", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.logoUrl, finnhubLogo);
  });

  it("SIE accepts SIE.XETRA donor with XETRA EODHD logo for DAX target", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "SIE.XETRA",
        name: "Siemens AG",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/XETRA/SIE.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "SIE", name: "Siemens AG", exchange: "DAX", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
    assert.equal(result.donor.symbol, "SIE.XETRA");
  });

  it("BAS accepts BAS.XETRA donor with XETRA EODHD logo for DAX target", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "BAS.XETRA",
        name: "BASF SE",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/XETRA/BAS.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "BAS", name: "BASF SE", exchange: "DAX", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
  });

  it("ALV accepts ALV.XETRA donor with XETRA EODHD logo for DAX target", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "ALV.XETRA",
        name: "Allianz SE",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/XETRA/ALV.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "ALV", name: "Allianz SE", exchange: "DAX", logoUrl: null }),
      donors,
    );
    assert.ok(result && "donor" in result);
  });

  it("MRK rejects MRK.XETRA donor with US EODHD logo path", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "MRK.XETRA",
        name: "Merck KGaA",
        exchange: "XETRA",
        logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "MRK", name: "Merck KGaA", exchange: "DAX", logoUrl: null }),
      donors,
    );
    assert.equal(result, null);
  });

  it("runCompanyLogoBackfill skips MRK copy from MRK.XETRA with US logo path", async () => {
    const update = mock.fn(async () => ({}));
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "MRK", name: "Merck KGaA", exchange: "DAX", logoUrl: null }];
      }
      return [
        {
          symbol: "MRK.XETRA",
          name: "Merck KGaA",
          exchange: "XETRA",
          logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
        },
      ];
    });

    const result = await runCompanyLogoBackfill(
      { limit: 1, dryRun: true, verbose: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhd: async () => null,
        fetchFinnhub: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.updated, 0);
    assert.equal(result.summary.skippedSuspiciousDonorLogo, 1);
    assert.equal(result.log.plannedUpdates.length, 0);
    assert.equal(result.log.suspiciousDonorLogos[0]?.donorSymbol, "MRK.XETRA");
    assert.equal(result.log.suspiciousDonorLogos[0]?.urlExchange, "US");
    assert.equal(update.mock.calls.length, 0);
    const verboseText = formatBackfillVerboseLog(result, { dryRun: true });
    assert.match(verboseText, /skippedSuspiciousDonorLogo/);
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

  it("MRK does not receive logo from MRK.US when Merck KGaA vs Merck & Co", () => {
    const donors = indexCompaniesWithLogo([
      row({
        symbol: "MRK.US",
        name: "Merck & Company Inc",
        exchange: "US",
        logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
      }),
    ]);
    const result = pickLogoDonorFromVariants(
      row({ symbol: "MRK", name: "Merck KGaA", exchange: "DAX", logoUrl: null }),
      donors,
    );
    assert.ok(result && "skipped" in result);
    assert.equal(result.skipped, "unsafe");
  });

  it("runCompanyLogoBackfill skips MRK dbVariant copy from MRK.US", async () => {
    const update = mock.fn(async () => ({}));
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "MRK", name: "Merck KGaA", exchange: "DAX", logoUrl: null }];
      }
      return [
        {
          symbol: "MRK.US",
          name: "Merck & Company Inc",
          exchange: "US",
          logoUrl: "https://eodhd.com/img/logos/US/mrk.png",
        },
      ];
    });

    const result = await runCompanyLogoBackfill(
      { limit: 1, dryRun: true, verbose: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhd: async () => null,
        fetchFinnhub: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.updated, 0);
    assert.equal(result.summary.skippedUnsafeMatch, 1);
    assert.equal(result.log.plannedUpdates.length, 0);
    assert.equal(update.mock.calls.length, 0);
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

describe("acceptProviderLogoForTarget", () => {
  const bdxTarget = row({
    symbol: "BDX",
    name: "Budimex S.A.",
    exchange: "WAR",
    logoUrl: null,
  });

  it("rejects Finnhub Becton Dickinson logo for Budimex BDX", () => {
    const result = acceptProviderLogoForTarget(
      bdxTarget,
      provider({
        logoUrl: "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BDX.png",
        name: "Becton Dickinson and Co",
        symbol: "BDX",
        exchange: "US",
      }),
    );
    assert.equal(result.accepted, false);
  });

  it("rejects Finnhub logo for bare WAR ticker CCC without matching name", () => {
    const result = acceptProviderLogoForTarget(
      row({ symbol: "CCC", name: "CCC S.A.", exchange: "WAR", logoUrl: null }),
      provider({
        logoUrl: "https://cdn.example/ccc.png",
        name: null,
        symbol: "CCC",
        exchange: null,
      }),
    );
    assert.equal(result.accepted, false);
  });

  it("accepts EODHD when provider name matches", () => {
    const result = acceptProviderLogoForTarget(
      row({ symbol: "AAPL.US", name: "Apple Inc", exchange: "US", logoUrl: null }),
      provider({
        logoUrl: "https://cdn.example/aapl.png",
        name: "Apple Inc",
        symbol: "AAPL.US",
        exchange: "US",
      }),
    );
    assert.equal(result.accepted, true);
    if (result.accepted) assert.equal(result.logoUrl, "https://cdn.example/aapl.png");
  });

  it("rejects EODHD when provider name does not match", () => {
    const result = acceptProviderLogoForTarget(
      bdxTarget,
      provider({
        logoUrl: "https://cdn.example/bdx-eod.png",
        name: "Becton Dickinson and Co",
        symbol: "BDX.US",
        exchange: "US",
      }),
    );
    assert.equal(result.accepted, false);
  });

  it("accepts ABBV.US when provider name matches AbbVie", () => {
    const result = acceptProviderLogoForTarget(
      row({ symbol: "ABBV.US", name: "AbbVie Inc", exchange: "US", logoUrl: null }),
      provider({
        logoUrl: "https://cdn.example/abbv.png",
        name: "AbbVie Inc",
        symbol: "ABBV.US",
        exchange: "US",
      }),
    );
    assert.equal(result.accepted, true);
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
        fetchEodhd: async () => null,
        fetchFinnhub: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(update.mock.calls.length, 1);
    assert.equal(savedLogo, "https://cdn.example/aapl.png");
    assert.equal(summary.updated, 1);
  });

  it("rejects Finnhub BDX logo and does not update", async () => {
    const update = mock.fn(async () => ({}));
    const findMany = mock.fn(async (args: { where?: { logoUrl?: null } }) => {
      if (args.where?.logoUrl === null) {
        return [{ symbol: "BDX", name: "Budimex S.A.", exchange: "WAR", logoUrl: null }];
      }
      return [];
    });

    const result = await runCompanyLogoBackfill(
      { limit: 1, dryRun: true, verbose: true },
      {
        db: { company: { findMany: findMany as never, update: update as never } },
        fetchEodhd: async () => null,
        fetchFinnhub: async () =>
          provider({
            logoUrl: "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BDX.png",
            name: "Becton Dickinson and Co",
            symbol: "BDX",
            exchange: "US",
          }),
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.updated, 0);
    assert.equal(result.summary.skippedProviderNameMismatch, 1);
    assert.equal(result.log.plannedUpdates.length, 0);
    assert.equal(result.log.providerNameMismatches.length, 1);
    assert.equal(result.log.providerNameMismatches[0]?.targetSymbol, "BDX");
    assert.equal(update.mock.calls.length, 0);
  });

  it("dryRun accepts EODHD when provider name matches", async () => {
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
        fetchEodhd: async () =>
          provider({
            logoUrl: "https://cdn.example/msft.png",
            name: "Microsoft Corp",
            symbol: "MSFT.US",
            exchange: "US",
          }),
        fetchFinnhub: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.updated, 1);
    assert.equal(result.summary.fetchedFromEodhd, 1);
    assert.equal(result.summary.skippedProviderNameMismatch, 0);
    assert.equal(update.mock.calls.length, 0);
    assert.equal(result.log.plannedUpdates[0]?.symbol, "MSFT");
    const verboseText = formatBackfillVerboseLog(result, { dryRun: true });
    assert.match(verboseText, /planned updates/);
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
        fetchEodhd: async () => null,
        fetchFinnhub: async () => null,
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
        fetchEodhd: async () => {
          throw new Error("EODHD fundamentals HTTP 401: api_token=secret123");
        },
        fetchFinnhub: async () => null,
        sleep: async () => {},
      },
    );

    assert.equal(result.summary.errors, 1);
    assert.equal(result.log.errors[0]?.symbol, "ERR");
    assert.match(result.log.errors[0]?.message ?? "", /api_token=\*\*\*/);
    assert.equal(update.mock.calls.length, 0);
  });
});
