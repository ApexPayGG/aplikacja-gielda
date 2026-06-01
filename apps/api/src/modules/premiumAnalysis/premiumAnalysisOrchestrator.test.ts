import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STOCK_AI_DATA_SNAPSHOT_VERSION, type StockAIDataSnapshot } from "./dataSnapshot";
import { buildFallbackPremiumAnalysisContract } from "./premiumAnalysisFallback";
import {
  PremiumAnalysisContractSchema,
  validatePremiumAnalysisContract,
} from "./premiumAnalysisContract";
import { readValidatedPremiumAnalysisCache } from "./premiumAnalysisOrchestrator";

function minimalSnapshot(overrides?: Partial<StockAIDataSnapshot>): StockAIDataSnapshot {
  const computedAt = new Date().toISOString();
  const ok = <T,>(value: T) => ({
    status: "ok" as const,
    value,
    asOf: computedAt,
    source: "test",
  });
  const missing = <T,>() => ({
    status: "missing" as const,
    value: null as T | null,
    asOf: null,
    source: null,
  });

  return {
    version: STOCK_AI_DATA_SNAPSHOT_VERSION,
    symbol: "TEST.US",
    resolvedSymbol: "TEST.US",
    computedAt,
    company: {
      name: ok("Test Co"),
      exchange: ok("NYSE"),
      sector: ok("Technology"),
      industry: ok("Software"),
      country: missing<string>(),
      currency: ok("USD"),
    },
    quote: {
      latest: ok({
        close: 100,
        open: 99,
        high: 101,
        low: 98,
        volume: "1000000",
        changePct: 1.2,
        previousClose: 98.8,
      }),
      history: ok({ sessionCount: 60, start: computedAt, end: computedAt }),
    },
    technical: {
      rsi14: ok(55),
      support60d: ok(92),
      resistance60d: ok(108),
      trendSummary: ok("Modest uptrend over recent sessions"),
    },
    fundamentals: {
      peTtm: ok(22),
      marketCap: ok(1_000_000_000),
      currency: ok("USD"),
    },
    news: missing<StockAIDataSnapshot["news"]["value"]>(),
    marketSignals: { status: "not_wired", value: null, asOf: null, source: "market_signals" },
    dividend: { status: "requires_access", value: null, asOf: null, source: "dividend_module" },
    userContext: { status: "not_wired", value: null, asOf: null, source: "user_context" },
    dataCoverage: ["quote.latest", "fundamentals.peTtm"],
    missingData: ["news"],
    ...overrides,
  };
}

describe("premiumAnalysisFallback", () => {
  it("fallback contract validates", () => {
    const contract = buildFallbackPremiumAnalysisContract(minimalSnapshot());
    const result = validatePremiumAnalysisContract(contract);
    assert.equal(result.success, true);
    const direct = PremiumAnalysisContractSchema.safeParse(contract);
    assert.equal(direct.success, true);
  });

  it("fallback scenarios include bull, base, and bear", () => {
    const contract = buildFallbackPremiumAnalysisContract(minimalSnapshot());
    const names = contract.scenarios.scenarios.map((s) => s.name).sort();
    assert.deepEqual(names, ["base", "bear", "bull"]);
    const sum = contract.scenarios.scenarios.reduce((acc, s) => acc + s.probabilityPct, 0);
    assert.equal(sum, 100);
  });

  it("fallback does not fabricate analyst ratings or targets", () => {
    const contract = buildFallbackPremiumAnalysisContract(minimalSnapshot());
    const blob = JSON.stringify(contract).toLowerCase();
    assert.ok(!blob.includes("avgtarget"));
    assert.ok(!blob.includes("\"buy\":"));
    assert.ok(!blob.includes("strong buy"));
    assert.equal(contract.historicalTwins.matchCount, 0);
    assert.equal(contract.valuationContext.metrics.every((m) => m.source !== "analyst_consensus"), true);
  });
});

describe("premiumAnalysisOrchestrator cache helper", () => {
  it("ignores invalid cached payload", () => {
    const invalid = { version: "1.0", symbol: "X" };
    assert.equal(readValidatedPremiumAnalysisCache(invalid), null);
  });

  it("accepts valid cached payload", () => {
    const contract = buildFallbackPremiumAnalysisContract(minimalSnapshot());
    assert.notEqual(readValidatedPremiumAnalysisCache(contract), null);
  });
});
