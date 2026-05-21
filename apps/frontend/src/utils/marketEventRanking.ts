import type { EventImportance, MarketEventDto } from "../types/marketEvents";
import { MARKET_EVENT_IMPORTANCE_RANK } from "../types/marketEvents";
import { eventMatchesWatchlistSymbol } from "./marketEventSymbols";

function importanceRank(value: string): number {
  return MARKET_EVENT_IMPORTANCE_RANK[value as EventImportance] ?? 0;
}

function isOnWatchlist(event: MarketEventDto, watchlistSymbols: string[]): boolean {
  return event.symbol != null && eventMatchesWatchlistSymbol(event.symbol, watchlistSymbols);
}

/** eventDate asc, then importance desc, then watchlist tie-breaker. */
export function compareMarketEvents(
  a: MarketEventDto,
  b: MarketEventDto,
  watchlistSymbols: string[],
): number {
  const dateDiff = a.eventDate.localeCompare(b.eventDate);
  if (dateDiff !== 0) return dateDiff;

  const impDiff = importanceRank(b.importance) - importanceRank(a.importance);
  if (impDiff !== 0) return impDiff;

  const aWl = isOnWatchlist(a, watchlistSymbols) ? 0 : 1;
  const bWl = isOnWatchlist(b, watchlistSymbols) ? 0 : 1;
  return aWl - bWl;
}

export function filterEventsForWatchlist(events: MarketEventDto[], watchlistSymbols: string[]): MarketEventDto[] {
  if (watchlistSymbols.length === 0) return events;
  return events.filter((e) => e.symbol != null && eventMatchesWatchlistSymbol(e.symbol, watchlistSymbols));
}

export type MarketEventPickScope = "watchlist" | "global" | "empty-watchlist";

export function pickTopMarketEvents(
  events: MarketEventDto[],
  watchlistSymbols: string[],
  limit = 3,
): { items: MarketEventDto[]; scope: MarketEventPickScope } {
  if (watchlistSymbols.length === 0) {
    return { items: [], scope: "empty-watchlist" };
  }

  const upcoming = events.filter((e) => e.daysToEvent >= 0);
  const sorted = [...upcoming].sort((a, b) => compareMarketEvents(a, b, watchlistSymbols));

  const watchlistOnly = filterEventsForWatchlist(sorted, watchlistSymbols);
  if (watchlistOnly.length > 0) {
    return { items: watchlistOnly.slice(0, limit), scope: "watchlist" };
  }

  return { items: sorted.slice(0, limit), scope: "global" };
}
