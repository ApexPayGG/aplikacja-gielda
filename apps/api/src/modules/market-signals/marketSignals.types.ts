export const MARKET_SIGNAL_TYPES = [
  "OPTIONS_FLOW",
  "DARK_POOL",
  "SEC_FILING",
  "WHALE_ACCUMULATION",
  "INSIDER_ACTIVITY",
  "ANALYST_REVISION",
] as const;

export type MarketSignalType = (typeof MARKET_SIGNAL_TYPES)[number];

export type MarketSignalDto = {
  id: string;
  ticker: string;
  signalType: MarketSignalType;
  source: string;
  confidenceScore: number;
  title: string;
  summary: string | null;
  rawPayload: unknown;
  eventTime: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketSignalsSummary = {
  total: number;
  byType: Partial<Record<MarketSignalType, number>>;
  strongestSignalType: MarketSignalType | null;
  averageConfidenceScore: number;
  whaleAccumulationDetected: boolean;
};

export type MarketSignalsListResponse = {
  ticker: string;
  lookbackDays: number;
  signals: MarketSignalDto[];
  summary: MarketSignalsSummary;
};

export type MarketSignalIngestInput = {
  ticker: string;
  signalType: MarketSignalType;
  source: string;
  confidenceScore: number;
  title: string;
  summary?: string;
  rawPayload?: unknown;
  eventTime?: string;
};

export type MarketSignalIngestResponse = {
  saved: true;
  signal: MarketSignalDto;
};

export const MARKET_SIGNAL_PROVIDERS = [
  "POLYGON_OPTIONS_FLOW",
  "POLYGON_DARK_POOL",
  "SEC_FILINGS",
  "EODHD_INSIDER_ACTIVITY",
] as const;

export type MarketSignalProvider = (typeof MARKET_SIGNAL_PROVIDERS)[number];

export type MarketSignalIngestionResult = {
  provider: MarketSignalProvider;
  parsedCount: number;
  savedCount: number;
  rejectedCount: number;
  signals: MarketSignalDto[];
};

export type SummarizableMarketSignal = {
  signalType: MarketSignalType;
  confidenceScore: number;
};
