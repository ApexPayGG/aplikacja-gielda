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

const SOURCE_LABELS: Record<string, string> = {
  "eodhd-insider-activity": "EODHD Insider Activity",
  "polygon-dark-pool": "Polygon Dark Pool",
  "polygon-options-flow": "Polygon Options Flow",
  "sec-filings": "SEC Filings",
};

export const CONFIDENCE_TIER_HINTS: Record<ConfidenceTier, string> = {
  high: "≥80",
  medium: "60–79",
  low: "<60",
};

export const MARKET_SIGNALS_READONLY_FOOTNOTE =
  "Institutional signals are read-only and generated from configured providers. This panel never triggers provider fetches.";

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

export function getConfidenceTierLabel(tier: ConfidenceTier): string {
  switch (tier) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

export function getSourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (SOURCE_LABELS[normalized]) return SOURCE_LABELS[normalized];
  return source
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatPayloadFieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPayloadScalar(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function summarizeRawPayload(raw: unknown, maxFields = 5): string[] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (lines.length >= maxFields) break;
    const formatted = formatPayloadScalar(value);
    if (formatted == null) continue;
    const text = formatted.length > 72 ? `${formatted.slice(0, 72)}…` : formatted;
    lines.push(`${formatPayloadFieldLabel(key)}: ${text}`);
  }
  return lines;
}
