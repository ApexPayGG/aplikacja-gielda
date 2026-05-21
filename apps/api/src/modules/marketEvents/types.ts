export type MarketEventType =
  | "earnings"
  | "dividend"
  | "split"
  | "ipo"
  | "macro"
  | "filing"
  | "insider"
  | "buyback"
  | "offering";

export type EventImportance = "low" | "medium" | "high" | "critical";

export type EventMarketTime = "before_market" | "after_market" | "during_market" | "unknown";

export type DeliveryChannel = "in_app" | "email" | "webhook" | "telegram" | "slack";

export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

/** Normalized event before DB upsert (global — not per user). */
export type NormalizedMarketEvent = {
  symbol: string | null;
  exchange?: string | null;
  eventType: MarketEventType;
  eventSubtype?: string | null;
  eventDate: string;
  eventTime?: EventMarketTime | null;
  importance: EventImportance;
  title: string;
  summary?: string | null;
  source: string;
  sourceUrl?: string | null;
  dedupeKey: string;
  payload?: Record<string, unknown> | null;
  fiscalPeriod?: string | null;
};

export type UserEventImpact = {
  onWatchlist: boolean;
  hasPaperPosition: boolean;
  riskLevel: EventImportance;
};

export type WatchlistDigestItem = {
  symbol: string | null;
  eventType: MarketEventType;
  eventDate: string;
  importance: EventImportance;
  title: string;
  summary: string | null;
  daysToEvent: number;
};

export type WatchlistDailyDigest = {
  date: string;
  headline: string;
  items: WatchlistDigestItem[];
  highRiskSymbols: string[];
  macroHighlights: WatchlistDigestItem[];
};

export const IMPORTANCE_RANK: Record<EventImportance, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function meetsMinImportance(
  event: EventImportance,
  min: EventImportance,
): boolean {
  return IMPORTANCE_RANK[event] >= IMPORTANCE_RANK[min];
}
