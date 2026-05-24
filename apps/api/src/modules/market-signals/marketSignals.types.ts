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

export type MarketSignalFetchErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_SEC_USER_AGENT"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INVALID_TICKER";

export type MarketSignalFetchResult = {
  ok: boolean;
  provider: MarketSignalProvider;
  ticker: string;
  payload: unknown;
  errorCode?: MarketSignalFetchErrorCode;
  statusCode?: number;
};

export type MarketSignalFetchEnqueueResult = {
  queued: boolean;
  provider: MarketSignalProvider;
  ticker: string;
  fetchOk: boolean;
  errorCode?: MarketSignalFetchErrorCode;
  jobId?: string;
};

export type MarketSignalsOpsProviderReadiness = {
  polygon: {
    apiKeyConfigured: boolean;
    usable: boolean;
  };
  eodhd: {
    apiKeyConfigured: boolean;
    usable: boolean;
  };
  sec: {
    userAgentConfigured: boolean;
    usable: boolean;
  };
};

export type MarketSignalsOpsQueueStats = {
  name: "market-signals-ingestion-queue";
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
};

export type MarketSignalsOpsDatabaseStats = {
  totalSignals24h: number;
  totalSignals7d: number;
  byType24h: Partial<Record<MarketSignalType, number>>;
  bySource24h: Record<string, number>;
  latestSignalAt: string | null;
};

export type MarketSignalsOpsHealthResponse = {
  ok: boolean;
  generatedAt: string;
  scheduler: {
    enabled: boolean;
    intervalMinutes: number;
    maxTickers: number;
    configuredTickers: string[];
    configuredProviders: MarketSignalProvider[];
  };
  providerReadiness: MarketSignalsOpsProviderReadiness;
  queue: MarketSignalsOpsQueueStats;
  database: MarketSignalsOpsDatabaseStats;
  warnings: string[];
};
