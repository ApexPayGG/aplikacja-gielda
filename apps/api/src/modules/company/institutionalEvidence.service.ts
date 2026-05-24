import {
  getEodhdTransactionDirection,
  getEodhdTransactionValue,
  isRecord,
} from "../market-signals/marketSignals.adapters";
import {
  normalizeMarketSignalTicker,
  summarizeMarketSignals,
} from "../market-signals/marketSignals.service";
import type { MarketSignalDto, MarketSignalsListResponse } from "../market-signals/marketSignals.types";
import type {
  DirtyTruthCandidate,
  InstitutionalEvidenceBlock,
  InstitutionalEvidenceInterpretation,
  InstitutionalEvidenceResponse,
  InstitutionalEvidenceStance,
} from "./institutionalEvidence.types";

export const INSTITUTIONAL_EVIDENCE_DEFAULT_LOOKBACK_DAYS = 90;
export const INSTITUTIONAL_EVIDENCE_MAX_LOOKBACK_DAYS = 365;
export const INSTITUTIONAL_EVIDENCE_MAX_BLOCKS = 20;

const MS_PER_DAY = 86_400_000;

export type InsiderClassification = {
  direction: "purchase" | "sale" | "transaction";
  isCongress: boolean;
  transactionValue: number | null;
  valueDisclosed: boolean;
};

export type InstitutionalEvidenceServiceDeps = {
  listSignals: (input: {
    ticker: string;
    lookbackDays?: number;
    minConfidence?: number;
  }) => Promise<MarketSignalsListResponse>;
  now?: () => Date;
};

function defaultNow(): Date {
  return new Date();
}

export function clampInstitutionalLookbackDays(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return INSTITUTIONAL_EVIDENCE_DEFAULT_LOOKBACK_DAYS;
  }
  return Math.min(
    INSTITUTIONAL_EVIDENCE_MAX_LOOKBACK_DAYS,
    Math.max(1, Math.floor(raw)),
  );
}

export function clampInstitutionalMinConfidence(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getSignalTypeLabel(signalType: MarketSignalDto["signalType"]): string {
  switch (signalType) {
    case "DARK_POOL":
      return "Dark Pool";
    case "OPTIONS_FLOW":
      return "Options Flow";
    case "SEC_FILING":
      return "SEC Filing";
    case "WHALE_ACCUMULATION":
      return "Whale Accumulation";
    case "INSIDER_ACTIVITY":
      return "Insider Activity";
    case "ANALYST_REVISION":
      return "Analyst Revision";
    default:
      return signalType;
  }
}

export function isCongressInsiderTrade(signal: MarketSignalDto): boolean {
  const haystack = `${signal.title} ${signal.summary ?? ""} ${signal.source}`.toLowerCase();
  if (
    /congress|senator|representative|legislative|stock act|house member|member of congress/.test(
      haystack,
    )
  ) {
    return true;
  }
  if (isRecord(signal.rawPayload)) {
    const ownerTitle = String(
      signal.rawPayload.ownerTitle ?? signal.rawPayload.reportingOwnerTitle ?? "",
    ).toLowerCase();
    if (/congress|senator|representative|legislative/.test(ownerTitle)) {
      return true;
    }
  }
  return false;
}

export function inferInsiderDirection(signal: MarketSignalDto): InsiderClassification["direction"] {
  const text = `${signal.title} ${signal.summary ?? ""}`.toLowerCase();
  if (text.includes("insider purchase") || /\binsider buy\b/.test(text)) {
    return "purchase";
  }
  if (text.includes("insider sale") || /\binsider sell\b/.test(text)) {
    return "sale";
  }
  if (isRecord(signal.rawPayload)) {
    return getEodhdTransactionDirection(signal.rawPayload);
  }
  return "transaction";
}

export function inferInsiderTransactionValue(signal: MarketSignalDto): number | null {
  if (isRecord(signal.rawPayload)) {
    const fromPayload = getEodhdTransactionValue(signal.rawPayload);
    if (fromPayload != null) return fromPayload;
  }

  const text = `${signal.title} ${signal.summary ?? ""}`;
  const match = text.match(/\$([0-9]+(?:\.[0-9]+)?)([KMB])\b/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2]?.toUpperCase();
  if (suffix === "B") return amount * 1_000_000_000;
  if (suffix === "M") return amount * 1_000_000;
  if (suffix === "K") return amount * 1_000;
  return amount;
}

export function classifyInsiderSignal(signal: MarketSignalDto): InsiderClassification {
  const direction = inferInsiderDirection(signal);
  const transactionValue = inferInsiderTransactionValue(signal);
  const valueDisclosed =
    transactionValue != null ||
    !(signal.summary ?? "").toLowerCase().includes("value was not disclosed");

  return {
    direction,
    isCongress: isCongressInsiderTrade(signal),
    transactionValue,
    valueDisclosed,
  };
}

export function interpretInsiderActivity(
  signal: MarketSignalDto,
  classification: InsiderClassification,
): InstitutionalEvidenceInterpretation {
  if (classification.isCongress) {
    const stance: InstitutionalEvidenceStance =
      classification.direction === "sale" ? "caution" : "neutral";
    const valueNote = classification.valueDisclosed
      ? "Disclosed amount is public filing context only."
      : "Transaction value was not disclosed in the source filing.";
    return {
      stance,
      text: "A disclosed legislative officeholder trade was reported. This reflects public disclosure rules, not corporate insider activity from company executives.",
      limitation: `${valueNote} Congressional trades are informational context and must not be read as a company insider signal.`,
    };
  }

  if (classification.direction === "purchase") {
    const valueNote = classification.valueDisclosed
      ? "Reported purchase size comes from provider disclosure and may be estimated."
      : "Transaction value was not disclosed in provider data.";
    return {
      stance: "positive",
      text: "An insider purchase was reported. This may reflect personal conviction, compensation activity, or planned disclosure — not a guaranteed bullish outcome.",
      limitation: `${valueNote} Insider filings are lagging and incomplete.`,
    };
  }

  if (classification.direction === "sale") {
    const valueNote = classification.valueDisclosed
      ? "Reported sale size comes from provider disclosure and may be estimated."
      : "Transaction value was not disclosed in provider data.";
    return {
      stance: "caution",
      text: "An insider sale was reported. Sales can reflect diversification, tax planning, or personal liquidity needs — not necessarily a negative outlook.",
      limitation: `${valueNote} Do not infer guaranteed direction from a single filing.`,
    };
  }

  return {
    stance: "neutral",
    text: "Insider activity was reported without a clear purchase or sale direction in available fields.",
    limitation: "Directional interpretation is limited when provider payloads omit transaction codes.",
  };
}

export function interpretSignal(signal: MarketSignalDto): InstitutionalEvidenceInterpretation {
  switch (signal.signalType) {
    case "INSIDER_ACTIVITY":
      return interpretInsiderActivity(signal, classifyInsiderSignal(signal));
    case "DARK_POOL":
      return {
        stance: "attention",
        text: "Large off-exchange activity was detected.",
        limitation:
          "Dark pool prints describe venue and size context; they do not prove institutional buying or selling direction.",
      };
    case "OPTIONS_FLOW":
      return {
        stance: "attention",
        text: "Options activity indicates speculative attention.",
        limitation:
          "Options flow can include hedging and market-making; no directional buy or sell claim is made without explicit payload support.",
      };
    case "SEC_FILING":
      return {
        stance: "neutral",
        text: "A regulatory filing was recorded that may provide company context or a future catalyst.",
        limitation: "Filings are factual disclosures, not recommendations or price targets.",
      };
    case "WHALE_ACCUMULATION":
      return {
        stance: signal.confidenceScore >= 75 ? "positive" : "attention",
        text:
          signal.confidenceScore >= 75
            ? "Multiple signals suggest sustained large-position interest."
            : "Large-position activity was detected with moderate confidence.",
        limitation:
          "Whale accumulation heuristics combine indirect flow signals and may miss offsetting activity.",
      };
    case "ANALYST_REVISION":
      return {
        stance: "neutral",
        text: "An analyst revision signal was recorded as institutional sentiment context.",
        limitation: "Analyst actions reflect third-party opinions, not verified transaction flow.",
      };
    default:
      return {
        stance: "neutral",
        text: "Institutional activity was recorded.",
        limitation: "Interpretation is limited for unrecognized signal categories.",
      };
  }
}

export function computeEvidenceScore(
  signals: MarketSignalDto[],
  now: Date,
): number {
  if (signals.length === 0) return 0;

  const averageConfidence =
    signals.reduce((sum, signal) => sum + signal.confidenceScore, 0) / signals.length;
  const uniqueTypes = new Set(signals.map((signal) => signal.signalType)).size;
  const recentCutoff = now.getTime() - 30 * MS_PER_DAY;
  const recentCount = signals.filter(
    (signal) => new Date(signal.eventTime).getTime() >= recentCutoff,
  ).length;

  const confidenceComponent = averageConfidence * 0.45;
  const diversityComponent = Math.min(uniqueTypes * 7, 28);
  const recencyComponent = Math.min(recentCount * 4, 16);
  const volumeComponent = Math.min(signals.length * 2, 11);

  return Math.round(
    Math.min(100, Math.max(0, confidenceComponent + diversityComponent + recencyComponent + volumeComponent)),
  );
}

function sortSignalsForEvidence(signals: MarketSignalDto[]): MarketSignalDto[] {
  return [...signals].sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    return new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime();
  });
}

function buildEvidenceBlocks(signals: MarketSignalDto[]): InstitutionalEvidenceBlock[] {
  return sortSignalsForEvidence(signals)
    .slice(0, INSTITUTIONAL_EVIDENCE_MAX_BLOCKS)
    .map((signal) => ({
      id: `evidence-${signal.id}`,
      signalId: signal.id,
      signalType: signal.signalType,
      label: getSignalTypeLabel(signal.signalType),
      source: signal.source,
      title: signal.title,
      summary: signal.summary ?? null,
      confidenceScore: signal.confidenceScore,
      eventTime: signal.eventTime,
      interpretation: interpretSignal(signal),
    }));
}

function insiderSignals(signals: MarketSignalDto[]): Array<{
  signal: MarketSignalDto;
  classification: InsiderClassification;
}> {
  return signals
    .filter((signal) => signal.signalType === "INSIDER_ACTIVITY")
    .map((signal) => ({
      signal,
      classification: classifyInsiderSignal(signal),
    }));
}

export function buildDirtyTruthCandidates(signals: MarketSignalDto[]): DirtyTruthCandidate[] {
  const candidates: DirtyTruthCandidate[] = [];
  const insiders = insiderSignals(signals);
  const sales = insiders.filter((entry) => entry.classification.direction === "sale");
  const purchases = insiders.filter((entry) => entry.classification.direction === "purchase");

  if (sales.length >= 3) {
    candidates.push({
      category: "insider",
      severity: "medium",
      title: "Repeated insider selling",
      explanation:
        "Three or more insider sales were recorded in the lookback window. This may warrant attention, but sales are not automatically bearish.",
      supportingSignalIds: sales.map((entry) => entry.signal.id),
    });
  }

  const aggregateSaleValue = sales.reduce((sum, entry) => {
    const value = entry.classification.transactionValue;
    return value != null ? sum + value : sum;
  }, 0);

  if (aggregateSaleValue >= 1_000_000) {
    candidates.push({
      category: "insider",
      severity: "high",
      title: "Material aggregate insider selling",
      explanation:
        "Known insider sale values sum to at least $1M in the lookback window. Disclosed values may be partial or estimated.",
      supportingSignalIds: sales
        .filter((entry) => entry.classification.transactionValue != null)
        .map((entry) => entry.signal.id),
    });
  }

  if (purchases.length === 0 && sales.length >= 2) {
    candidates.push({
      category: "insider",
      severity: "medium",
      title: "Insider sales without offsetting purchases",
      explanation:
        "Multiple insider sales were recorded with no insider purchases in the same window. Context may still include planned 10b5-1 sales.",
      supportingSignalIds: sales.map((entry) => entry.signal.id),
    });
  }

  const darkPoolSignals = signals.filter((signal) => signal.signalType === "DARK_POOL");
  const optionsSignals = signals.filter((signal) => signal.signalType === "OPTIONS_FLOW");
  if (darkPoolSignals.length > 0 && optionsSignals.length > 0) {
    candidates.push({
      category: "multi_signal",
      severity: "medium",
      title: "Concurrent dark pool and options flow",
      explanation:
        "Both off-exchange and options activity appeared in the lookback window, suggesting elevated institutional and speculative attention.",
      supportingSignalIds: [
        ...darkPoolSignals.map((signal) => signal.id),
        ...optionsSignals.map((signal) => signal.id),
      ],
    });
  }

  const positiveSignals = signals.filter((signal) => {
    if (signal.signalType === "WHALE_ACCUMULATION" && signal.confidenceScore >= 75) return true;
    if (signal.signalType === "INSIDER_ACTIVITY") {
      const classification = classifyInsiderSignal(signal);
      return classification.direction === "purchase" && !classification.isCongress;
    }
    return false;
  });
  const cautionSignals = signals.filter((signal) => {
    if (signal.signalType === "INSIDER_ACTIVITY") {
      const classification = classifyInsiderSignal(signal);
      return classification.direction === "sale";
    }
    return false;
  });

  if (positiveSignals.length > 0 && cautionSignals.length > 0) {
    candidates.push({
      category: "multi_signal",
      severity: "medium",
      title: "Mixed institutional picture",
      explanation:
        "Supportive and cautionary institutional signals co-exist in the lookback window. Treat the picture as mixed rather than one-sided.",
      supportingSignalIds: [
        ...positiveSignals.map((signal) => signal.id),
        ...cautionSignals.map((signal) => signal.id),
      ],
    });
  }

  return candidates;
}

export function buildInstitutionalEvidenceLimitations(
  signals: MarketSignalDto[],
  lookbackDays: number,
): string[] {
  const limitations = [
    "Institutional evidence is factual context, not investment advice or a trade recommendation.",
    "Evidence scores measure signal breadth and confidence — not buy/sell direction.",
  ];

  if (signals.length === 0) {
    limitations.push(`No institutional signals were recorded in the last ${lookbackDays} days.`);
    return limitations;
  }

  const undisclosedInsiderValues = insiderSignals(signals).filter(
    (entry) => !entry.classification.valueDisclosed,
  );
  if (undisclosedInsiderValues.length > 0) {
    limitations.push("Some insider records omit transaction value in provider disclosures.");
  }

  if (signals.some((signal) => signal.signalType === "DARK_POOL")) {
    limitations.push("Dark pool activity does not prove net buying or selling direction.");
  }

  if (signals.some((signal) => signal.signalType === "OPTIONS_FLOW")) {
    limitations.push("Options flow may include hedging; directional claims require explicit confirmation.");
  }

  return limitations;
}

export function buildInstitutionalEvidenceFromSignals(input: {
  ticker: string;
  lookbackDays: number;
  signals: MarketSignalDto[];
  now?: Date;
}): InstitutionalEvidenceResponse {
  const signals = input.signals;
  const now = input.now ?? defaultNow();
  const marketSummary = summarizeMarketSignals(signals);
  const insiders = insiderSignals(signals);

  return {
    ticker: normalizeMarketSignalTicker(input.ticker),
    lookbackDays: input.lookbackDays,
    generatedAt: now.toISOString(),
    summary: {
      totalSignals: signals.length,
      averageConfidenceScore: marketSummary.averageConfidenceScore,
      strongestSignalType: marketSummary.strongestSignalType,
      hasInsiderBuying: insiders.some(
        (entry) => entry.classification.direction === "purchase",
      ),
      hasInsiderSelling: insiders.some((entry) => entry.classification.direction === "sale"),
      hasWhaleAccumulation: marketSummary.whaleAccumulationDetected,
      hasDarkPoolActivity: signals.some((signal) => signal.signalType === "DARK_POOL"),
      hasOptionsFlow: signals.some((signal) => signal.signalType === "OPTIONS_FLOW"),
      evidenceScore: computeEvidenceScore(signals, now),
    },
    evidenceBlocks: buildEvidenceBlocks(signals),
    dirtyTruthCandidates: buildDirtyTruthCandidates(signals),
    limitations: buildInstitutionalEvidenceLimitations(signals, input.lookbackDays),
  };
}

export async function getInstitutionalEvidence(
  input: {
    ticker: string;
    lookbackDays?: number;
    minConfidence?: number;
  },
  depsInput?: InstitutionalEvidenceServiceDeps,
): Promise<InstitutionalEvidenceResponse> {
  const deps: InstitutionalEvidenceServiceDeps = {
    listSignals: depsInput?.listSignals ?? (async () => {
      throw new Error("listSignals dependency is required");
    }),
    now: depsInput?.now ?? defaultNow,
  };

  const ticker = normalizeMarketSignalTicker(input.ticker);
  const lookbackDays = clampInstitutionalLookbackDays(input.lookbackDays);
  const minConfidence = clampInstitutionalMinConfidence(input.minConfidence);
  const now = deps.now!();

  const listed = await deps.listSignals({
    ticker,
    lookbackDays,
    minConfidence,
  });

  return buildInstitutionalEvidenceFromSignals({
    ticker,
    lookbackDays,
    signals: listed.signals,
    now,
  });
}
