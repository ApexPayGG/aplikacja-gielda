import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STOCK_AI_DATA_SNAPSHOT_VERSION, type StockAIDataSnapshot } from "./dataSnapshot";
import { buildFallbackPremiumAnalysisContract } from "./premiumAnalysisFallback";
import {
  PremiumAnalysisContractSchema,
  validatePremiumAnalysisContract,
} from "./premiumAnalysisContract";
import {
  ANALYSIS_MAX_TOKENS,
  ANALYSIS_REPAIR_MIN_TIME_BUDGET_MS,
  ANALYSIS_REPAIR_MAX_FIRST_CALL_LATENCY_MS,
  ANALYSIS_TOTAL_SOFT_BUDGET_MS,
  buildPremiumAnalysisSingleFlightTimeoutBundle,
  PremiumAnalysisUsageLimitExceededError,
  likelyTruncatedAnthropicResponse,
  readValidatedPremiumAnalysisCache,
  shouldAttemptPremiumAnalysisRepair,
} from "./premiumAnalysisOrchestrator";

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

describe("PremiumAnalysisUsageLimitExceededError", () => {
  it("exposes 429 response fields", () => {
    const err = new PremiumAnalysisUsageLimitExceededError("limited", "PRO", 3, 3600);
    assert.equal(err.code, "PREMIUM_ANALYSIS_DAILY_LIMIT");
    assert.equal(err.statusCode, 429);
    assert.equal(err.tier, "PRO");
    assert.equal(err.limit, 3);
    assert.equal(err.resetIn, 3600);
    assert.equal(err.name, "PremiumAnalysisUsageLimitExceededError");
    assert.equal(err.message, "limited");
  });
});

describe("premium analysis latency guard", () => {
  it("detects max_tokens truncation signals", () => {
    assert.equal(
      likelyTruncatedAnthropicResponse({
        contract: null,
        raw: "{}",
        model: "claude-sonnet-4-6",
        latencyMs: 1000,
        stopReason: "max_tokens",
      }),
      true,
    );
    assert.equal(
      likelyTruncatedAnthropicResponse({
        contract: null,
        raw: "x".repeat(ANALYSIS_MAX_TOKENS * 3),
        model: "claude-sonnet-4-6",
        latencyMs: 1000,
        outputTokens: ANALYSIS_MAX_TOKENS,
      }),
      true,
    );
    assert.equal(
      likelyTruncatedAnthropicResponse({
        contract: null,
        raw: '{"ok":true}',
        model: "claude-sonnet-4-6",
        latencyMs: 1000,
        outputTokens: 120,
        stopReason: "end_turn",
      }),
      false,
    );
  });

  it("skips repair when first response is truncated", () => {
    const startedAt = Date.now() - 10_000;
    const first = {
      contract: null,
      raw: "",
      model: "claude-sonnet-4-6",
      latencyMs: 60_000,
      outputTokens: ANALYSIS_MAX_TOKENS,
      stopReason: "max_tokens",
    };
    assert.equal(shouldAttemptPremiumAnalysisRepair(first, startedAt), false);
  });

  it("skips repair when first call is too slow for repair budget", () => {
    const startedAt = Date.now() - 5_000;
    const first = {
      contract: null,
      raw: '{"invalid":true}',
      model: "claude-sonnet-4-6",
      latencyMs: ANALYSIS_REPAIR_MAX_FIRST_CALL_LATENCY_MS,
      outputTokens: 800,
      stopReason: "end_turn",
    };
    assert.equal(shouldAttemptPremiumAnalysisRepair(first, startedAt), false);
  });

  it("skips repair for production-like slow first call around 42s", () => {
    const startedAt = Date.now() - 5_000;
    const first = {
      contract: null,
      raw: '{"invalid":true}',
      model: "claude-sonnet-4-6",
      latencyMs: 42_729,
      outputTokens: 800,
      stopReason: "end_turn",
    };
    assert.equal(shouldAttemptPremiumAnalysisRepair(first, startedAt), false);
  });

  it("skips repair when soft budget is exhausted", () => {
    const startedAt = Date.now() - (ANALYSIS_TOTAL_SOFT_BUDGET_MS - ANALYSIS_REPAIR_MIN_TIME_BUDGET_MS + 1);
    const first = {
      contract: null,
      raw: '{"invalid":true}',
      model: "claude-sonnet-4-6",
      latencyMs: 50_000,
      outputTokens: 500,
      stopReason: "end_turn",
    };
    assert.equal(shouldAttemptPremiumAnalysisRepair(first, startedAt), false);
  });

  it("allows repair only when first call is fast, budget remains, and response is not truncated", () => {
    const startedAt = Date.now() - 5_000;
    const first = {
      contract: null,
      raw: '{"invalid":true}',
      model: "claude-sonnet-4-6",
      latencyMs: ANALYSIS_REPAIR_MAX_FIRST_CALL_LATENCY_MS - 1,
      outputTokens: 800,
      stopReason: "end_turn",
    };
    assert.equal(shouldAttemptPremiumAnalysisRepair(first, startedAt), true);
  });
});

describe("premium analysis single-flight timeout fallback", () => {
  it("returns validated fallback bundle without cache write fields", () => {
    const snapshot = minimalSnapshot();
    const bundle = buildPremiumAnalysisSingleFlightTimeoutBundle(snapshot, "hash-test");
    assert.equal(bundle.cacheStatus, "fallback");
    assert.equal(bundle.provider.name, "fallback");
    assert.equal(bundle.provider.retryCount, 0);
    assert.equal(bundle.snapshotHash, "hash-test");
    const validated = validatePremiumAnalysisContract(bundle.contract);
    assert.equal(validated.success, true);
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
