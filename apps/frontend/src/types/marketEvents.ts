export type MarketEventType = "earnings" | "dividend" | "macro" | string;
export type EventImportance = "low" | "medium" | "high" | "critical";

export type MarketEventDto = {
  id: string;
  symbol: string | null;
  eventType: MarketEventType;
  eventSubtype?: string | null;
  eventDate: string;
  eventTime?: string | null;
  importance: EventImportance;
  title: string;
  summary?: string | null;
  payload?: unknown;
  daysToEvent: number;
};

export const MARKET_EVENT_IMPORTANCE_RANK: Record<EventImportance, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
