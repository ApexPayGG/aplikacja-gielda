export const NEWS_SENTIMENT_QUEUE_NAME = "news-sentiment-queue";

export const NEWS_SENTIMENT_JOB_NAMES = {
  REFRESH_TICKER_INTEL: "refresh-ticker-intel",
  INVALIDATE_TICKER_INTEL: "invalidate-ticker-intel",
  WARM_CACHE_BATCH: "warm-cache-batch",
} as const;

export type NewsSentimentJobName =
  (typeof NEWS_SENTIMENT_JOB_NAMES)[keyof typeof NEWS_SENTIMENT_JOB_NAMES];

export type NewsSentimentActTier =
  | "ACT_1_CORE_HISTORY"
  | "ACT_2_PRESENT_SENTIMENT"
  | "ACT_3_SCENARIOS";

export const NEWS_SENTIMENT_TTL_SEC = {
  ACT_1_CORE_HISTORY: 30 * 86_400,
  ACT_2_PRESENT_SENTIMENT: 86_400,
  ACT_3_SCENARIOS: 7 * 86_400,
  LOCK: 120,
} as const;

export type ProviderHealth = "ok" | "missing_key" | "error" | "skipped";

export type ProviderStatus = {
  anthropic: ProviderHealth;
  finnhub: ProviderHealth;
  eodhd: ProviderHealth;
  polygon: ProviderHealth;
};

export type NarrativeActPayload = {
  tier: NewsSentimentActTier;
  summary: string;
  bulletPoints: string[];
  sentimentScore: number | null;
  sources: string[];
  generatedAt: string;
  degraded?: boolean;
};

export type InvalidationState = {
  act2Invalidated: boolean;
  act3Invalidated: boolean;
  lastInvalidationReason: string | null;
  lastInvalidatedAt: string | null;
  intradayChangePct: number | null;
  ma200Break: boolean;
  earningsEventDetected: boolean;
};

export type NewsSentimentActs = {
  act1: NarrativeActPayload | null;
  act2: NarrativeActPayload | null;
  act3: NarrativeActPayload | null;
};

export type NewsSentimentFullPayload = {
  ticker: string;
  generatedAt: string;
  providerStatus: ProviderStatus;
  acts: NewsSentimentActs;
  invalidationState: InvalidationState;
};

export type NewsSentimentMetaPayload = {
  ticker: string;
  lastPrice: number | null;
  lastOpen: number | null;
  ma200: number | null;
  ma200Side: "above" | "below" | "unknown";
  updatedAt: string;
  invalidationState: InvalidationState;
};

export type RefreshTickerIntelJobData = {
  ticker: string;
  force?: boolean;
};

export type InvalidateTickerIntelJobData = {
  ticker: string;
  reason: string;
};

export type WarmCacheBatchJobData = {
  tickers?: string[];
};

export type NewsSentimentJobData =
  | RefreshTickerIntelJobData
  | InvalidateTickerIntelJobData
  | WarmCacheBatchJobData;

export type ProviderNewsItem = {
  headline: string;
  source: string;
  datetime: number;
  url?: string;
};

export type MarketIntelSignals = {
  intradayChangePct: number;
  earningsEventDetected: boolean;
  currentPrice: number | null;
  previousPrice: number | null;
  ma200: number | null;
  ma200Break: boolean;
};

export type ProviderContext = {
  ticker: string;
  news: ProviderNewsItem[];
  dailyCloses: number[];
  quote: {
    price: number;
    open: number;
  } | null;
  providerStatus: ProviderStatus;
  signals: MarketIntelSignals;
};
