export const MARKET_SIGNAL_TYPES = [
  "OPTIONS_FLOW",
  "DARK_POOL",
  "SEC_FILING",
  "WHALE_ACCUMULATION",
  "INSIDER_ACTIVITY",
  "ANALYST_REVISION",
] as const;

export type MarketSignalType = (typeof MARKET_SIGNAL_TYPES)[number];

export type MarketSignal = {
  id: string;
  ticker: string;
  signalType: MarketSignalType;
  source: string;
  confidenceScore: number;
  title: string;
  summary?: string | null;
  rawPayload?: unknown;
  eventTime: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketSignalsResponse = {
  ticker: string;
  lookbackDays: number;
  signals: MarketSignal[];
  summary: {
    total: number;
    byType: Partial<Record<MarketSignalType, number>>;
    strongestSignalType: MarketSignalType | null;
    averageConfidenceScore: number;
    whaleAccumulationDetected: boolean;
  };
};

export type ConfidenceTier = "high" | "medium" | "low";

export function getSignalTypeLabel(signalType: MarketSignalType): string {
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

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function summarizeRawPayload(raw: unknown, maxFields = 5): string[] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (lines.length >= maxFields) break;
    if (value == null || value === "") continue;
    if (typeof value === "object") {
      const preview = JSON.stringify(value);
      lines.push(`${key}: ${preview.length > 72 ? `${preview.slice(0, 72)}…` : preview}`);
      continue;
    }
    const text = String(value);
    lines.push(`${key}: ${text.length > 72 ? `${text.slice(0, 72)}…` : text}`);
  }
  return lines;
}
