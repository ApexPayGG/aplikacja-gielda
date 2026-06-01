import type { StockAIDataSnapshot } from "./dataSnapshot";
import type { PremiumAnalysisContract } from "./premiumAnalysisContract";
import { PREMIUM_ANALYSIS_CONTRACT_VERSION } from "./premiumAnalysisModelTasks";

type NumericClaim = PremiumAnalysisContract["valuationContext"]["metrics"][number];

function claim(
  value: number,
  basis: string,
  source: string,
  asOf?: string | null,
): NumericClaim {
  const row: NumericClaim = { value, basis, source };
  if (asOf) row.asOf = asOf;
  return row;
}

function buildFreshness(snapshot: StockAIDataSnapshot): PremiumAnalysisContract["dataFreshness"] {
  const sources: PremiumAnalysisContract["dataFreshness"]["sources"] = [
    { id: "quote.latest", asOf: snapshot.quote.latest.asOf ?? null, status: snapshot.quote.latest.status },
    { id: "quote.history", asOf: snapshot.quote.history.asOf ?? null, status: snapshot.quote.history.status },
    { id: "technical.rsi14", asOf: snapshot.technical.rsi14.asOf ?? null, status: snapshot.technical.rsi14.status },
    { id: "fundamentals.peTtm", asOf: snapshot.fundamentals.peTtm.asOf ?? null, status: snapshot.fundamentals.peTtm.status },
    { id: "news", asOf: snapshot.news.asOf ?? null, status: snapshot.news.status },
    { id: "marketSignals", asOf: snapshot.marketSignals.asOf ?? null, status: snapshot.marketSignals.status },
    { id: "dividend", asOf: snapshot.dividend.asOf ?? null, status: snapshot.dividend.status },
  ];
  return {
    computedAt: snapshot.computedAt,
    snapshotVersion: snapshot.version,
    sources,
    coverage: [...snapshot.dataCoverage],
    missingData: [...snapshot.missingData],
  };
}

function resolveVerdict(snapshot: StockAIDataSnapshot): {
  label: PremiumAnalysisContract["executiveVerdict"]["label"];
  confidence: number;
} {
  const quoteOk = snapshot.quote.latest.status === "ok";
  const rsi = snapshot.technical.rsi14.value;
  const trend = snapshot.technical.trendSummary.value?.toLowerCase() ?? "";
  const pe = snapshot.fundamentals.peTtm.value;
  const changePct = snapshot.quote.latest.value?.changePct ?? null;

  if (!quoteOk) return { label: "watch", confidence: 35 };

  let score = 50;
  if (trend.includes("uptrend") || trend.includes("up")) score += 12;
  if (trend.includes("downtrend") || trend.includes("down")) score -= 18;
  if (rsi != null) {
    if (rsi > 70) score -= 8;
    else if (rsi < 35) score += 4;
  }
  if (pe != null) {
    if (pe > 35) score -= 6;
    else if (pe > 0 && pe < 18) score += 4;
  }
  if (changePct != null) {
    if (changePct > 3) score += 4;
    if (changePct < -3) score -= 8;
  }

  if (score >= 62) return { label: "constructive", confidence: Math.min(68, score) };
  if (score >= 52) return { label: "hold", confidence: Math.min(58, score) };
  if (score <= 38) return { label: "watch", confidence: Math.max(32, score) };
  return { label: "hold", confidence: 45 };
}

export function buildFallbackPremiumAnalysisContract(
  snapshot: StockAIDataSnapshot,
): PremiumAnalysisContract {
  const now = new Date().toISOString();
  const symbol = snapshot.resolvedSymbol ?? snapshot.symbol;
  const companyName = snapshot.company.name.value ?? symbol;
  const { label, confidence } = resolveVerdict(snapshot);
  const quote = snapshot.quote.latest.value;
  const close = quote?.close ?? null;
  const quoteAsOf = snapshot.quote.latest.asOf ?? now;
  const horizonMonths = 12;

  const metrics: NumericClaim[] = [];
  if (snapshot.fundamentals.peTtm.status === "ok" && snapshot.fundamentals.peTtm.value != null) {
    metrics.push(
      claim(
        snapshot.fundamentals.peTtm.value,
        "Price divided by TTM EPS from fundamentals",
        snapshot.fundamentals.peTtm.source ?? "fundamentals_eps_ttm",
        snapshot.fundamentals.peTtm.asOf,
      ),
    );
  }
  if (snapshot.fundamentals.marketCap.status === "ok" && snapshot.fundamentals.marketCap.value != null) {
    metrics.push(
      claim(
        snapshot.fundamentals.marketCap.value,
        "Latest market cap fundamental",
        snapshot.fundamentals.marketCap.source ?? "fundamentals_market_cap",
        snapshot.fundamentals.marketCap.asOf,
      ),
    );
  }

  const levels: NumericClaim[] = [];
  if (snapshot.technical.support60d.status === "ok" && snapshot.technical.support60d.value != null) {
    levels.push(
      claim(
        snapshot.technical.support60d.value,
        "60-session low support",
        "quote_history_60d",
        snapshot.quote.history.value?.end ?? quoteAsOf,
      ),
    );
  }
  if (snapshot.technical.resistance60d.status === "ok" && snapshot.technical.resistance60d.value != null) {
    levels.push(
      claim(
        snapshot.technical.resistance60d.value,
        "60-session high resistance",
        "quote_history_60d",
        snapshot.quote.history.value?.end ?? quoteAsOf,
      ),
    );
  }

  const missingNote =
    snapshot.missingData.length > 0
      ? ` Coverage gaps: ${snapshot.missingData.slice(0, 6).join(", ")}${snapshot.missingData.length > 6 ? "-" : ""}.`
      : "";

  const contract: PremiumAnalysisContract = {
    version: PREMIUM_ANALYSIS_CONTRACT_VERSION,
    symbol,
    generatedAt: now,
    dataFreshness: buildFreshness(snapshot),
    executiveVerdict: {
      label,
      headline: `${companyName}: conservative ${label} view (deterministic fallback)`,
      summary: `Educational synthesis based on available StockAI snapshot only.${missingNote} This is not investment advice and does not guarantee returns.`,
      confidence,
      horizonMonths,
      educationalNote:
        "Deterministic fallback - generated without LLM. Validate data coverage before acting on any view.",
    },
    businessEngine: {
      overview: `${companyName} (${symbol}) - sector ${snapshot.company.sector.value ?? "unknown"}, industry ${snapshot.company.industry.value ?? "unknown"}. Overview limited to snapshot fields.`,
      competitiveDynamics:
        "Competitive dynamics not fully wired in snapshot; treat qualitative statements as illustrative only.",
      catalysts: [
        snapshot.news.status === "ok" && snapshot.news.value?.length
          ? `Recent headline flow (${snapshot.news.value.length} items in snapshot)`
          : "Monitor upcoming company disclosures",
      ],
      risks: [
        snapshot.missingData.length > 2 ? "Incomplete fundamental coverage in snapshot" : "Standard execution and macro risks",
        snapshot.marketSignals.status !== "ok" ? "Market signal feed incomplete" : "Signal dispersion may shift quickly",
      ],
    },
    valuationContext: {
      summary:
        metrics.length > 0
          ? "Valuation context uses only fundamentals present in the snapshot."
          : "Insufficient fundamental fields for a quantitative valuation view - stay in watch mode.",
      metrics,
      historicalContext: "No third-party analyst price targets are included in this fallback.",
    },
    technicalSetup: {
      summary:
        quote != null
          ? `Latest close ${close} with ${snapshot.technical.trendSummary.value ?? "unclear"} trend label from 60-session history.`
          : "Quote data unavailable - technical setup is incomplete.",
      trend: snapshot.technical.trendSummary.value ?? "Trend not computed from available history",
      levels,
      momentumNotes:
        snapshot.technical.rsi14.status === "ok" && snapshot.technical.rsi14.value != null
          ? `RSI(14) - ${Math.round(snapshot.technical.rsi14.value)}`
          : "RSI unavailable",
    },
    scenarios: {
      horizonMonths,
      scenarios: [
        {
          name: "bull",
          probabilityPct: 25,
          narrative: "Upside case if trend and fundamentals improve versus snapshot baseline - qualitative only.",
          drivers: ["Positive earnings revision cycle", "Improved risk appetite"],
          risks: ["Multiple already stretched", "Macro headwinds"],
          invalidation: "Sustained close below snapshot support level on volume",
          priceTarget:
            close != null && snapshot.technical.resistance60d.value != null
              ? claim(
                  snapshot.technical.resistance60d.value,
                  "Resistance from 60-session history (not a guaranteed target)",
                  "quote_history_60d",
                  snapshot.quote.history.value?.end ?? quoteAsOf,
                )
              : undefined,
        },
        {
          name: "base",
          probabilityPct: 50,
          narrative: "Base case: price action follows current trend band with no major structural change.",
          drivers: ["Stable operating backdrop", "In-line macro"],
          risks: ["Earnings volatility", "Sector rotation"],
          invalidation: "Trend summary flips negative for multiple sessions",
        },
        {
          name: "bear",
          probabilityPct: 25,
          narrative: "Downside case if support fails or fundamentals deteriorate versus snapshot.",
          drivers: ["Risk-off markets", "Negative revisions"],
          risks: ["Liquidity gaps", "Higher discount rate"],
          invalidation: "Reclaim of resistance with improving breadth",
          priceTarget:
            close != null && snapshot.technical.support60d.value != null
              ? claim(
                  snapshot.technical.support60d.value,
                  "Support from 60-session history (stress reference, not advice)",
                  "quote_history_60d",
                  snapshot.quote.history.value?.end ?? quoteAsOf,
                )
              : undefined,
        },
      ],
    },
    riskMap: {
      summary: "Risk map derived from snapshot coverage gaps and market/technical flags only.",
      items: [
        {
          id: "data-coverage",
          title: "Incomplete data coverage",
          description:
            snapshot.missingData.length > 0
              ? `Missing paths: ${snapshot.missingData.join(", ")}`
              : "Core quote and history present; residual model risk remains.",
          severity: snapshot.missingData.length > 3 ? "high" : "medium",
          likelihood: snapshot.missingData.length > 0 ? "medium" : "low",
          category: "data_quality",
        },
        {
          id: "market-vol",
          title: "Price volatility",
          description: "Historical session dispersion may widen drawdowns versus base case.",
          severity: "medium",
          likelihood: "medium",
          category: "market",
        },
      ],
    },
    historicalTwins: {
      summary:
        "Historical twin matching is not included in this deterministic fallback bundle.",
      matchCount: 0,
      lesson: "Use the dedicated /twins endpoint for pattern analogues when available.",
    },
    thesisInvalidators: {
      summary: "Educational triggers that would weaken the current snapshot-implied view.",
      items: [
        {
          trigger: "Quote feed stale or missing for multiple sessions",
          impact: "high",
          monitor: "quote.latest status and asOf in snapshot",
        },
        {
          trigger: "RSI extreme with trend reversal",
          impact: "medium",
          monitor: "technical.rsi14 and trendSummary",
        },
      ],
    },
    decisionNote: {
      note: `Educational note for ${symbol}: deterministic fallback only - research further before decisions. No buy/sell instruction.${missingNote}`,
      stance: label === "constructive" ? "constructive" : label === "avoid" ? "avoid" : "watch",
      keyQuestions: [
        "Which snapshot fields are still missing or not_wired?",
        "Does trend align with your horizon and risk tolerance?",
        "What would invalidate the base case?",
      ],
    },
    dataCoverage: [...snapshot.dataCoverage],
    missingData: [...snapshot.missingData],
  };

  if (snapshot.userContext.status === "ok" && snapshot.userContext.value) {
    const uc = snapshot.userContext.value;
    contract.personalFit = {
      summary: "Personal fit uses trader profile and check-in fields from snapshot only.",
      alignmentScore: clampAlignment(uc.riskLevelToday, label),
      matches: uc.watchlistContainsSymbol ? ["Symbol on user watchlist"] : [],
      mismatches:
        uc.riskLevelToday === "high" && label === "constructive"
          ? ["High risk day vs constructive label - size cautiously"]
          : [],
      suggestedActions: ["Review snapshot missingData before sizing exposure"],
    };
  }

  return contract;
}

function clampAlignment(riskLevel: string | null, label: string): number {
  let base = 50;
  if (label === "constructive") base += 10;
  if (label === "watch") base -= 10;
  if (riskLevel === "low") base += 8;
  if (riskLevel === "high") base -= 12;
  return Math.min(85, Math.max(20, base));
}
