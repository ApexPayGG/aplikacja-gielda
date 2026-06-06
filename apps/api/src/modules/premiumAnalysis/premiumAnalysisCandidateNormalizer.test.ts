import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STOCK_AI_DATA_SNAPSHOT_VERSION, type StockAIDataSnapshot } from "./dataSnapshot";
import { normalizePremiumAnalysisCandidate } from "./premiumAnalysisCandidateNormalizer";
import {
  buildPremiumAnalysisRawPreview,
  isPremiumAnalysisDebugRawEnabled,
} from "./premiumAnalysisOrchestrator";
import { validatePremiumAnalysisContract } from "./premiumAnalysisContract";

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
    symbol: "AMD.US",
    resolvedSymbol: "AMD.US",
    computedAt,
    company: {
      name: ok("Advanced Micro Devices"),
      exchange: ok("NASDAQ"),
      sector: ok("Technology"),
      industry: ok("Semiconductors"),
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
      trendSummary: ok("Uptrend"),
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
    dataCoverage: ["quote.latest"],
    missingData: ["news"],
    ...overrides,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

describe("normalizePremiumAnalysisCandidate", () => {
  const generatedAt = "2026-05-28T12:00:00.000Z";
  const snapshot = minimalSnapshot();

  it("maps technicalContext to technicalSetup", () => {
    const parsed = { technicalContext: { summary: "Trend up", trend: "Bullish", levels: [] } };
    const { candidate, changedFields } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const record = asRecord(candidate);
    const ts = asRecord(record.technicalSetup);
    assert.equal(ts.summary, "Trend up");
    assert.equal(ts.trend, "Bullish");
    assert.match(changedFields.join(","), /technicalContext/);
  });

  it("fills dataFreshness.computedAt from generatedAt", () => {
    const parsed = { generatedAt, dataFreshness: { sources: [] } };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const df = asRecord(asRecord(candidate).dataFreshness);
    assert.equal(df.computedAt, generatedAt);
  });

  it("fills dataFreshness.sources[].id", () => {
    const parsed = {
      generatedAt,
      dataFreshness: { sources: [{ status: "ok" }, { key: "quotes", status: "missing" }] },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const sources = asRecord(asRecord(candidate).dataFreshness).sources as Record<string, unknown>[];
    assert.equal(sources[0]?.id, "source_1");
    assert.equal(sources[1]?.id, "quotes");
  });

  it("converts numeric string metric values to numbers", () => {
    const parsed = {
      generatedAt,
      valuationContext: {
        metrics: [{ value: "28.5", basis: "P/E", source: "fundamentals" }],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const metric = (asRecord(asRecord(candidate).valuationContext).metrics as Record<string, unknown>[])[0];
    assert.equal(metric?.value, 28.5);
  });

  it("does not coerce non-numeric metric values to numbers", () => {
    const parsed = {
      generatedAt,
      valuationContext: {
        metrics: [{ value: "N/A", basis: "P/E", source: "fundamentals" }],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const metric = (asRecord(asRecord(candidate).valuationContext).metrics as Record<string, unknown>[])[0];
    assert.equal(metric?.value, "N/A");
  });

  it("fills metric asOf from generatedAt when null", () => {
    const parsed = {
      generatedAt,
      valuationContext: {
        metrics: [{ value: 10, basis: "P/E", source: "fundamentals", asOf: null }],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const metric = (asRecord(asRecord(candidate).valuationContext).metrics as Record<string, unknown>[])[0];
    assert.equal(metric?.asOf, generatedAt);
  });

  it("fills scenarios.horizonMonths = 12", () => {
    const parsed = { scenarios: { scenarios: [] } };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    assert.equal(asRecord(asRecord(candidate).scenarios).horizonMonths, 12);
  });

  it("fills scenario narrative from summary/rationale or conservative fallback", () => {
    const parsed = {
      scenarios: {
        scenarios: [{ name: "bull", summary: "Upside case" }, { name: "base", rationale: "Base" }, {}],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const scenarios = asRecord(asRecord(candidate).scenarios).scenarios as Record<string, unknown>[];
    assert.equal(scenarios[0]?.narrative, "Upside case");
    assert.equal(scenarios[1]?.narrative, "Base");
    assert.equal(scenarios[2]?.narrative, "Scenario narrative not provided by model.");
  });

  it("maps executiveVerdict aliases without inventing missing strings", () => {
    const withAliases = {
      generatedAt,
      decisionNote: { note: "Educational only." },
      executiveVerdict: { title: "Constructive setup", disclaimer: "Not advice." },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(withAliases, snapshot);
    const ev = asRecord(asRecord(candidate).executiveVerdict);
    assert.equal(ev.headline, "Constructive setup");
    assert.equal(ev.educationalNote, "Not advice.");

    const withoutAliases = { executiveVerdict: { label: "hold" } };
    const bare = normalizePremiumAnalysisCandidate(withoutAliases, snapshot);
    const bareEv = asRecord(asRecord(bare.candidate).executiveVerdict);
    assert.equal(bareEv.headline, undefined);
    assert.equal(bareEv.educationalNote, undefined);
  });

  it("does not mutate the original parsed object", () => {
    const parsed = {
      technicalContext: { summary: "A", trend: "B", levels: [] },
      valuationContext: { metrics: [{ value: "12", basis: "x", source: "y" }] },
    };
    const before = JSON.stringify(parsed);
    normalizePremiumAnalysisCandidate(parsed, snapshot);
    assert.equal(JSON.stringify(parsed), before);
  });

  it("fills executiveVerdict.summary from aliases", () => {
    const parsed = {
      generatedAt,
      decisionNote: { note: "Educational synthesis." },
      executiveVerdict: {
        headline: "Constructive AMD setup",
        educationalNote: "Not investment advice.",
        verdictSummary: "Educational constructive view on AMD.",
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const ev = asRecord(asRecord(candidate).executiveVerdict);
    assert.equal(ev.summary, "Educational constructive view on AMD.");
  });

  it("normalizes nested businessEngine aliases", () => {
    const parsed = {
      businessEngine: {
        businessOverview: "CPU and GPU platform.",
        marketPosition: "Competitive in data center.",
        growthDrivers: "AI accelerators",
        headwinds: "Cyclical demand",
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const be = asRecord(asRecord(candidate).businessEngine);
    assert.equal(be.overview, "CPU and GPU platform.");
    assert.equal(be.competitiveDynamics, "Competitive in data center.");
    assert.deepEqual(be.catalysts, ["AI accelerators"]);
    assert.deepEqual(be.risks, ["Cyclical demand"]);
  });

  it("converts businessEngine catalyst and risk strings to arrays", () => {
    const parsed = {
      businessEngine: {
        overview: "Overview",
        competitiveDynamics: "Dynamics",
        catalysts: "Single catalyst",
        risks: "Single risk",
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const be = asRecord(asRecord(candidate).businessEngine);
    assert.deepEqual(be.catalysts, ["Single catalyst"]);
    assert.deepEqual(be.risks, ["Single risk"]);
  });

  it("normalizes technicalSetup summary and trend aliases", () => {
    const parsed = {
      technicalSetup: {
        setup: "Price above support.",
        direction: "Uptrend",
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const ts = asRecord(asRecord(candidate).technicalSetup);
    assert.equal(ts.summary, "Price above support.");
    assert.equal(ts.trend, "Uptrend");
  });

  it("creates technicalSetup levels from snapshot support and resistance when levels missing", () => {
    const parsed = { generatedAt, technicalSetup: { summary: "Trend", trend: "Up" } };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const levels = asRecord(asRecord(candidate).technicalSetup).levels as Record<string, unknown>[];
    assert.equal(levels.length, 2);
    assert.equal(levels[0]?.value, 92);
    assert.equal(levels[1]?.value, 108);
  });

  it("deletes null scenario priceTarget", () => {
    const parsed = {
      scenarios: {
        scenarios: [{ name: "bull", priceTarget: null }, { name: "base" }],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const scenarios = asRecord(asRecord(candidate).scenarios).scenarios as Record<string, unknown>[];
    assert.equal("priceTarget" in (scenarios[0] ?? {}), false);
  });

  it("normalizes riskMap summary and item required fields", () => {
    const parsed = {
      riskMap: {
        items: [
          { name: "Valuation", summary: "High multiple", severity: "unknown", likelihood: null },
        ],
      },
    };
    const { candidate } = normalizePremiumAnalysisCandidate(parsed, snapshot);
    const riskMap = asRecord(asRecord(candidate).riskMap);
    assert.equal(riskMap.summary, "Risk map derived from model-provided risk items.");
    const item = (riskMap.items as Record<string, unknown>[])[0];
    assert.equal(item?.id, "Valuation");
    assert.equal(item?.title, "Valuation");
    assert.equal(item?.description, "High multiple");
    assert.equal(item?.category, "general");
    assert.equal(item?.severity, "medium");
    assert.equal(item?.likelihood, "medium");
  });

  it("reduces validation issues for NVDA-like drift candidate", () => {
    const nvdaLike = {
      version: "1.0",
      symbol: "NVDA.US",
      generatedAt,
      company: {
        overview: "GPU platform leader.",
        competitiveDynamics: "Scale and ecosystem.",
        catalysts: ["AI demand"],
        risks: ["Competition"],
      },
      technicalContext: {
        summary: "Strong trend",
        trend: "Uptrend",
        levels: [{ value: "100", basis: "support", source: "quote", asOf: null }],
      },
      dataFreshness: {
        snapshotVersion: "1.0",
        sources: [{ status: "ok" }],
        coverage: [],
        missingData: [],
      },
      executiveVerdict: {
        label: "constructive",
        title: "AI leadership premium",
        summary: "Educational constructive view.",
        confidence: 70,
        horizonMonths: 12,
      },
      valuationContext: {
        metrics: [{ value: "45.2", basis: "P/E", source: "fundamentals", asOf: null }],
      },
      scenarios: {
        scenarios: [
          { name: "bull", probabilityPct: 30, summary: "Beat", drivers: ["AI"], risks: ["Macro"], invalidation: "x" },
          { name: "base", probabilityPct: 50, rationale: "Steady", drivers: ["Demand"], risks: ["Valuation"], invalidation: "y" },
          { name: "bear", probabilityPct: 20, drivers: ["Rates"], risks: ["Growth"], invalidation: "z" },
        ],
      },
      decisionNote: { note: "Educational synthesis.", stance: "research", keyQuestions: ["Growth durable?"] },
      riskMap: { summary: "Risks", items: [{ id: "r1", title: "Valuation", description: "High multiple", severity: "medium", likelihood: "medium", category: "valuation" }] },
      historicalTwins: { summary: "Limited analogs", matchCount: 0, lesson: "Patience helps." },
      thesisInvalidators: {
        summary: "Watch growth",
        items: [{ trigger: "Miss", impact: "high", monitor: "Earnings" }],
      },
      dataCoverage: ["quote.latest"],
      missingData: [],
    };

    const before = validatePremiumAnalysisContract(nvdaLike);
    assert.equal(before.success, false);
    if (before.success) return;

    const { candidate, changedFields } = normalizePremiumAnalysisCandidate(nvdaLike, snapshot);
    assert.ok(changedFields.length > 0);
    assert.ok(changedFields.some((field) => field.includes("technicalContext")));

    const after = validatePremiumAnalysisContract(candidate);
    if (after.success) {
      assert.ok(after.data.businessEngine);
      assert.ok(after.data.technicalSetup);
      return;
    }

    assert.ok(after.error.issues.length < before.error.issues.length);
  });

  it("normalizes AMD-like nested drift candidate toward full validation", () => {
    const amdLike = {
      version: "1.0",
      symbol: "AMD.US",
      generatedAt,
      dataFreshness: {
        snapshotVersion: "1.0",
        sources: [{ status: "ok" }],
        coverage: ["quote.latest"],
        missingData: [],
      },
      executiveVerdict: {
        label: "constructive",
        headline: "AMD constructive educational view",
        educationalNote: "Educational only, not investment advice.",
        confidence: 68,
        horizonMonths: 12,
      },
      businessEngine: {
        businessOverview: "CPU and GPU platform exposure.",
        industryDynamics: "Technology / Semiconductors",
        drivers: "AI and data center demand",
        keyRisks: "Cyclicality and competition",
      },
      technicalSetup: {
        setup: "Holding above recent support.",
        trendLabel: "Modest uptrend",
      },
      valuationContext: {
        summary: "Valuation context from snapshot fundamentals.",
        metrics: [{ value: "32.1", basis: "P/E", source: "fundamentals", asOf: null }],
      },
      scenarios: {
        scenarios: [
          {
            name: "bull",
            probabilityPct: 30,
            rationale: "Upside from AI demand",
            drivers: ["AI"],
            risks: ["Macro"],
            invalidation: "Break support",
            priceTarget: null,
          },
          {
            name: "base",
            probabilityPct: 50,
            summary: "Steady execution",
            drivers: ["Share gains"],
            risks: ["Valuation"],
            invalidation: "Guidance cut",
            priceTarget: null,
          },
          {
            name: "bear",
            probabilityPct: 20,
            description: "Cyclical downturn",
            drivers: ["Inventory"],
            risks: ["Demand"],
            invalidation: "Revenue miss",
            priceTarget: null,
          },
        ],
      },
      riskMap: {
        items: [
          { factor: "Valuation", detail: "Premium multiple leaves less room for misses." },
        ],
      },
      historicalTwins: { summary: "Limited analogs", matchCount: 0, lesson: "Patience helps." },
      thesisInvalidators: {
        summary: "Watch demand",
        items: [{ trigger: "Revenue miss", impact: "high", monitor: "Earnings" }],
      },
      decisionNote: {
        note: "Educational synthesis for AMD.",
        stance: "research",
        keyQuestions: ["Is AI demand durable?"],
      },
      dataCoverage: ["quote.latest"],
      missingData: [],
    };

    const before = validatePremiumAnalysisContract(amdLike);
    assert.equal(before.success, false);
    if (before.success) return;

    const { candidate, changedFields } = normalizePremiumAnalysisCandidate(amdLike, snapshot);
    assert.ok(changedFields.length > 0);

    const after = validatePremiumAnalysisContract(candidate);
    assert.equal(after.success, true);
    if (!after.success) return;

    assert.equal(after.data.executiveVerdict.summary, "Educational synthesis for AMD.");
    assert.equal(after.data.businessEngine.overview, "CPU and GPU platform exposure.");
    assert.equal(after.data.businessEngine.competitiveDynamics, "Technology / Semiconductors");
    assert.deepEqual(after.data.businessEngine.catalysts, ["AI and data center demand"]);
    assert.deepEqual(after.data.businessEngine.risks, ["Cyclicality and competition"]);
    assert.equal(after.data.technicalSetup.summary, "Holding above recent support.");
    assert.equal(after.data.technicalSetup.trend, "Modest uptrend");
    assert.ok(after.data.technicalSetup.levels.length >= 1);
    assert.equal(after.data.scenarios.horizonMonths, 12);
    assert.equal(after.data.scenarios.scenarios[0].priceTarget, undefined);
    assert.equal(after.data.riskMap.summary, "Risk map derived from model-provided risk items.");
    assert.equal(after.data.riskMap.items[0].id, "Valuation");
    assert.equal(after.data.riskMap.items[0].title, "Valuation");
    assert.equal(after.data.riskMap.items[0].category, "general");
  });
});

describe("premium analysis debug raw preview", () => {
  it("omits raw preview unless debug flag is enabled", () => {
    const old = process.env.PREMIUM_ANALYSIS_DEBUG_RAW;
    try {
      delete process.env.PREMIUM_ANALYSIS_DEBUG_RAW;
      assert.equal(isPremiumAnalysisDebugRawEnabled(), false);
      assert.equal(buildPremiumAnalysisRawPreview("secret"), undefined);
    } finally {
      if (old === undefined) delete process.env.PREMIUM_ANALYSIS_DEBUG_RAW;
      else process.env.PREMIUM_ANALYSIS_DEBUG_RAW = old;
    }
  });
});
