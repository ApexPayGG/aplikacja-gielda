import { CalendarDaysIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  GLASS_BTN_GHOST,
  GLASS_BTN_PRIMARY,
  GLASS_INNER_PANEL,
  GLASS_LINK_ACCENT,
  GLASS_SECTION,
  GLASS_SECTION_TITLE,
} from "./behavioral-coach/glassStyles";
import { getMarketEvents } from "../services/api";
import type { EventImportance, MarketEventDto, MarketEventType } from "../types/marketEvents";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatDividendPerShareAmount, readDividendPayload } from "../utils/dividendFormat";
import { resolveIntlLocale } from "../utils/formatters";
import { pickTopMarketEvents } from "../utils/marketEventRanking";
import { eventMatchesWatchlistSymbol } from "../utils/marketEventSymbols";

type EventRiskRadarWidgetProps = {
  watchlistSymbols: string[];
};

function eventTypeLabel(type: MarketEventType, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  if (type === "earnings") return t("marketEvents.type.earnings", { defaultValue: "Earnings" });
  if (type === "dividend") return t("marketEvents.type.dividend", { defaultValue: "Dividend" });
  if (type === "macro") return t("marketEvents.type.macro", { defaultValue: "Macro" });
  return type;
}

function importanceLabel(
  importance: EventImportance,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  const map: Record<EventImportance, string> = {
    critical: t("marketEvents.importance.critical", { defaultValue: "Critical" }),
    high: t("marketEvents.importance.high", { defaultValue: "High" }),
    medium: t("marketEvents.importance.medium", { defaultValue: "Medium" }),
    low: t("marketEvents.importance.low", { defaultValue: "Low" }),
  };
  return map[importance] ?? importance;
}

function importanceBadgeClass(importance: EventImportance): string {
  if (importance === "critical") return "border-terminal-negative/40 bg-terminal-negative/15 text-terminal-negative";
  if (importance === "high") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  if (importance === "medium") return "border-terminal-cyan/35 bg-terminal-cyan/10 text-terminal-cyan";
  return "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textMuted";
}

function eventTypeBadgeClass(type: MarketEventType): string {
  if (type === "earnings") return "border-terminal-cyan/35 bg-terminal-cyan/10 text-terminal-cyan";
  if (type === "dividend") return "border-terminal-cyan/30 bg-terminal-panelSecondary text-terminal-cyan";
  if (type === "macro") return "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textSecondary";
  return "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textMuted";
}

function formatDaysToEvent(
  days: number,
  t: (key: string, opts?: { defaultValue?: string; count?: number }) => string,
): string {
  if (days <= 0) return t("marketEvents.days.today", { defaultValue: "today" });
  if (days === 1) return t("marketEvents.days.tomorrow", { defaultValue: "tomorrow" });
  return t("marketEvents.days.inDays", { count: days, defaultValue: "in {{count}} days" });
}

function formatEventDate(eventDate: string, locale: string): string {
  const parsed = new Date(`${eventDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return eventDate;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

function companyLinkSymbol(event: MarketEventDto): string | null {
  if (!event.symbol?.trim()) return null;
  return event.symbol.trim().toUpperCase();
}

export function EventRiskRadarWidget({ watchlistSymbols }: EventRiskRadarWidgetProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MarketEventDto[]>([]);

  const normalizedWatchlist = useMemo(
    () => watchlistSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean),
    [watchlistSymbols],
  );

  const hasWatchlist = normalizedWatchlist.length > 0;

  useEffect(() => {
    if (!hasWatchlist) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getMarketEvents({ limit: 50 });
        if (!cancelled) setEvents(rows);
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err));
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasWatchlist]);

  const { items: topEvents, scope } = useMemo(
    () => pickTopMarketEvents(events, normalizedWatchlist, 3),
    [events, normalizedWatchlist],
  );

  const locale = resolveIntlLocale(i18n.language);

  return (
    <section className={GLASS_SECTION}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-terminal-cyan" aria-hidden />
            <h2 className={GLASS_SECTION_TITLE}>
              {t("marketEvents.radar.title", { defaultValue: "Event Risk Radar" })}
            </h2>
          </div>
          <p className="mt-2 max-w-xl text-sm text-terminal-textMuted">
            {t("marketEvents.radar.subtitle", {
              defaultValue: "Upcoming events that may affect your decisions.",
            })}
          </p>
        </div>
        <Link
          to="/market-events"
          className={`${GLASS_BTN_GHOST} shrink-0 px-3 py-1.5 text-xs`}
        >
          {t("marketEvents.radar.viewCalendar", { defaultValue: "View calendar" })}
        </Link>
      </div>

      {loading ? (
        <p className={`${GLASS_INNER_PANEL} px-4 py-3 text-sm text-terminal-textMuted`}>
          {t("common.loading", { defaultValue: "Loading..." })}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-terminal-negative/35 bg-terminal-negative/10 px-4 py-3 text-sm text-terminal-negative">
          {error}
        </p>
      ) : null}

      {!loading && !error && scope === "empty-watchlist" ? (
        <div className={`${GLASS_INNER_PANEL} border-dashed px-4 py-5 text-sm`}>
          <p className="font-medium text-terminal-text">
            {t("marketEvents.radar.emptyWatchlistTitle", {
              defaultValue: "Add companies to unlock your Event Risk Radar",
            })}
          </p>
          <p className="mt-2 text-terminal-textMuted">
            {t("marketEvents.radar.emptyWatchlistBody", {
              defaultValue:
                "We will track earnings, dividends and key market events for the stocks you actually follow.",
            })}
          </p>
          <Link to="/companies" className={`${GLASS_BTN_PRIMARY} mt-4 inline-flex px-4 py-2 text-xs`}>
            {t("marketEvents.radar.browseCompanies", { defaultValue: "Browse companies" })}
          </Link>
        </div>
      ) : null}

      {!loading && !error && hasWatchlist && topEvents.length === 0 ? (
        <div className={`${GLASS_INNER_PANEL} border-dashed px-4 py-4 text-sm`}>
          <p className="font-medium text-terminal-text">
            {t("marketEvents.radar.emptyTitle", { defaultValue: "No upcoming events in this horizon" })}
          </p>
          <p className="mt-2 text-terminal-textMuted">
            {t("marketEvents.radar.emptyHint", {
              defaultValue: "Check back soon or open the calendar for the full schedule.",
            })}
          </p>
          <Link to="/market-events" className={`${GLASS_LINK_ACCENT} mt-3 inline-block text-sm`}>
            {t("marketEvents.radar.viewCalendar", { defaultValue: "View calendar" })}
          </Link>
        </div>
      ) : null}

      {!loading && !error && topEvents.length > 0 ? (
        <>
          {scope === "global" ? (
            <p className="mb-3 text-xs text-terminal-textMuted">
              {t("marketEvents.radar.globalFallback", {
                defaultValue: "No watchlist events found — showing nearest global events.",
              })}
            </p>
          ) : null}
          <ul className="space-y-3">
            {topEvents.map((event) => {
              const symbol = event.symbol?.trim().toUpperCase() ?? null;
              const onWatchlist =
                symbol != null && eventMatchesWatchlistSymbol(symbol, normalizedWatchlist);
              const linkSymbol = companyLinkSymbol(event);

              return (
                <li key={event.id} className={`${GLASS_INNER_PANEL} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-terminal-text">
                        {symbol ?? t("marketEvents.macroSymbol", { defaultValue: "MACRO" })}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${eventTypeBadgeClass(event.eventType)}`}
                      >
                        {eventTypeLabel(event.eventType, t)}
                      </span>
                      {onWatchlist ? (
                        <span className="rounded-full border border-terminal-cyan/35 bg-terminal-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-terminal-cyan">
                          {t("marketEvents.radar.onWatchlist", { defaultValue: "Watchlist" })}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${importanceBadgeClass(event.importance)}`}
                    >
                      {importanceLabel(event.importance, t)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-terminal-textMuted">
                    <span>{formatEventDate(event.eventDate, locale)}</span>
                    <span className="font-semibold text-terminal-cyan">{formatDaysToEvent(event.daysToEvent, t)}</span>
                    {event.eventType === "dividend" && symbol ? (() => {
                      const dividend = readDividendPayload(event.payload);
                      if (dividend?.dividendPerShare == null) return null;
                      return (
                        <span className="font-mono text-terminal-textSecondary">
                          {formatDividendPerShareAmount(dividend.dividendPerShare, symbol, {
                            currency: dividend.currency,
                          })}
                        </span>
                      );
                    })() : null}
                  </div>

                  {event.summary?.trim() ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-terminal-textSecondary">{event.summary}</p>
                  ) : (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-terminal-textMuted">{event.title}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {linkSymbol ? (
                      <Link
                        to={`/company/${encodeURIComponent(linkSymbol)}`}
                        className={`${GLASS_LINK_ACCENT} text-xs font-semibold`}
                      >
                        {t("marketEvents.radar.prepare", { defaultValue: "Prepare" })}
                      </Link>
                    ) : (
                      <Link to="/market-events" className={`${GLASS_LINK_ACCENT} text-xs font-semibold`}>
                        {t("marketEvents.radar.prepare", { defaultValue: "Prepare" })}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {!loading && !error && hasWatchlist && topEvents.some((e) => e.importance === "critical" || e.importance === "high") ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-200/80">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("marketEvents.radar.highRiskHint", {
            defaultValue: "High-importance events detected — plan your exposure before the session.",
          })}
        </p>
      ) : null}
    </section>
  );
}
