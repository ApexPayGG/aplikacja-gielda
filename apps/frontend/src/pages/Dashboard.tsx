import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/CompanyLogo";
import { DailyCheckInWidget, type DailyCheckInWidgetState } from "../components/DailyCheckInWidget";
import { EventRiskRadarWidget } from "../components/EventRiskRadarWidget";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import {
  AccentPanel,
  cn,
  CockpitBand,
  CompactEmptyState,
  MarketDelta,
  ModuleCTAButton,
  StatusPill,
  TERMINAL_ACCENT_RAIL_AMBER,
  TERMINAL_ACCENT_RAIL_CYAN,
  TERMINAL_ACCENT_RAIL_LIME,
  TERMINAL_MODULE_PANEL,
  TerminalBadge,
  TerminalButton,
  TerminalMetricCard,
  TerminalSection,
  TerminalTable,
  TerminalTableBody,
  TerminalTableCell,
  TerminalTableHead,
  TerminalTableHeaderCell,
  TerminalTableRow,
  TerminalWorkspacePage,
} from "../components/terminal";
import { useAuth } from "../context/AuthContext";
import { getCompanyDetail, getLatestQuoteBySymbol, getWatchlist } from "../services/api";
import { enrichItemsWithCompanyLogos } from "../utils/companyLogoEnrichment";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCurrency } from "../utils/formatters";

type WatchedCompany = {
  symbol: string;
  name: string;
  exchange: string | null;
  logoUrl: string | null;
  close: number | null;
  changePct: number | null;
};

const SUGGESTED_TICKERS = ["AAPL.US", "MSFT.US", "NVDA.US"] as const;

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [watchlistRows, setWatchlistRows] = useState<WatchedCompany[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [checkInState, setCheckInState] = useState<DailyCheckInWidgetState>({
    hasCheckedIn: false,
    riskLevel: null,
    aiMessage: null,
    mood: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setWatchlistRows([]);
      setWatchlistError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setWatchlistLoading(true);
      setWatchlistError(null);
      try {
        const rows = await getWatchlist(user.id);
        const enriched = await Promise.all(
          rows.map(async (item) => {
            const symbol = item.symbol.toUpperCase();
            const [company, quote] = await Promise.all([
              getCompanyDetail(symbol).catch(() => null),
              getLatestQuoteBySymbol(symbol).catch(() => null),
            ]);

            const close = quote ? Number(quote.close) : null;
            const open = quote ? Number(quote.open) : null;
            const changePct =
              close != null && open != null && Number.isFinite(close) && Number.isFinite(open) && open !== 0
                ? ((close - open) / open) * 100
                : null;

            return {
              symbol,
              name: company?.name ?? symbol,
              exchange: company?.exchange ?? null,
              logoUrl: company?.logoUrl ?? null,
              close: close != null && Number.isFinite(close) ? close : null,
              changePct: changePct != null && Number.isFinite(changePct) ? changePct : null,
            } as WatchedCompany;
          }),
        );

        if (!cancelled) {
          const withLogos = await enrichItemsWithCompanyLogos(
            enriched.map((row) => ({
              ...row,
              ticker: row.symbol,
            })),
          );
          setWatchlistRows(
            withLogos.map((row) => ({
              symbol: row.symbol,
              name: row.name,
              exchange: row.exchange,
              logoUrl: row.logoUrl ?? null,
              close: row.close,
              changePct: row.changePct,
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setWatchlistError(apiErrorMessage(error));
          setWatchlistRows([]);
        }
      } finally {
        if (!cancelled) {
          setWatchlistLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const quickStats = useMemo(() => {
    const signalCount = watchlistRows.filter((row) => row.changePct !== null && Math.abs(row.changePct) >= 2).length;
    return {
      signalCount,
      watchlistCount: watchlistRows.length,
    };
  }, [watchlistRows]);

  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return null;
    return raw.split(/\s+/)[0];
  }, [user?.name]);

  const isEmptyDashboard = !watchlistLoading && !watchlistError && watchlistRows.length === 0;
  const hasWatchlistMetrics = quickStats.watchlistCount > 0;
  const noDataLabel = t("dashboard.statNoData", { defaultValue: "—" });

  const todayLabel = useMemo(() => {
    const locale = i18n.resolvedLanguage || i18n.language || "en";
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, [i18n.language, i18n.resolvedLanguage]);

  const marketState = useMemo(() => {
    if (watchlistLoading) {
      return {
        label: t("dashboard.marketState.loading", { defaultValue: "Syncing quotes" }),
        variant: "soon" as const,
      };
    }
    if (watchlistRows.length === 0) {
      return {
        label: t("dashboard.marketState.setup", { defaultValue: "Watchlist not configured" }),
        variant: "inactive" as const,
      };
    }
    const withQuotes = watchlistRows.filter((row) => row.changePct != null);
    if (withQuotes.length === 0) {
      return {
        label: t("dashboard.marketState.awaiting", { defaultValue: "Awaiting session data" }),
        variant: "soon" as const,
      };
    }
    const positiveMoves = withQuotes.filter((row) => (row.changePct ?? 0) > 0).length;
    return {
      label: t("dashboard.marketState.summary", {
        positive: positiveMoves,
        total: withQuotes.length,
        defaultValue: "{{positive}}/{{total}} tickers green today",
      }),
      variant: positiveMoves >= withQuotes.length / 2 ? ("live" as const) : ("closed" as const),
    };
  }, [t, watchlistLoading, watchlistRows]);

  const psycheKpi = useMemo(() => {
    if (!checkInState.hasCheckedIn || !checkInState.riskLevel) {
      return { value: noDataLabel, hint: t("dashboard.kpi.psychePending", { defaultValue: "Complete daily check-in" }) };
    }
    return {
      value: t(`checkin.risk.${checkInState.riskLevel}`, { defaultValue: checkInState.riskLevel }),
      hint: t("dashboard.kpi.psycheDone", { defaultValue: "Risk mindset logged today" }),
    };
  }, [checkInState.hasCheckedIn, checkInState.riskLevel, noDataLabel, t]);

  const eventRiskKpi = useMemo(() => {
    if (!hasWatchlistMetrics) {
      return {
        value: noDataLabel,
        hint: t("dashboard.kpi.eventRiskEmpty", { defaultValue: "Add symbols to scan events" }),
      };
    }
    return {
      value: t("dashboard.kpi.eventRiskActive", { defaultValue: "Active" }),
      hint: t("dashboard.kpi.eventRiskHint", { defaultValue: "See Event Risk Radar below" }),
    };
  }, [hasWatchlistMetrics, noDataLabel, t]);

  const latestSignals = useMemo(
    () =>
      watchlistRows
        .filter((row) => row.changePct != null)
        .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
        .slice(0, 5),
    [watchlistRows],
  );

  const watchlistSymbols = useMemo(() => watchlistRows.map((row) => row.symbol), [watchlistRows]);

  const hubSetupPanel = (
    <div className="border-t border-terminal-cyan/15 pt-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("dashboard.hero.eyebrow", { defaultValue: "Your StockAI hub" })}
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-terminal-text">
            {t("dashboard.hero.title", { defaultValue: "Build your market watchlist" })}
          </h2>
          <p className="mt-1 line-clamp-2 max-w-3xl text-[11px] leading-snug text-terminal-textSecondary">
            {t("dashboard.hero.subtitle", {
              defaultValue:
                "Add a few tickers to unlock live quotes, movement alerts, and AI context tailored to what you actually trade.",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link to="/companies">
            <ModuleCTAButton variant="primary" size="sm">
              {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
            </ModuleCTAButton>
          </Link>
          <Link to="/signals">
            <ModuleCTAButton variant="secondary" size="sm">
              {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
            </ModuleCTAButton>
          </Link>
          <Link to="/behavioral-coach">
            <TerminalButton variant="ghost" size="sm">
              {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
            </TerminalButton>
          </Link>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-terminal-borderMuted/70 pt-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-terminal-textMuted">
          {t("dashboard.hero.popularLabel", { defaultValue: "Popular to start" })}
        </p>
        {SUGGESTED_TICKERS.map((symbol) => (
          <Link key={symbol} to={`/company/${encodeURIComponent(symbol)}`}>
            <TerminalBadge variant="ai" className="cursor-pointer transition hover:border-terminal-cyan/60">
              {symbol}
            </TerminalBadge>
          </Link>
        ))}
      </div>
    </div>
  );

  const watchlistOperationalStrip = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-terminal-positive/20 pt-2.5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-terminal-positive shadow-[0_0_6px_rgba(74,222,128,0.55)]" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-terminal-positive">
          {t("dashboard.hub.operational", { defaultValue: "Watchlist operational" })}
        </p>
      </div>
      <TerminalBadge variant="default">
        {t("dashboard.watchlistCount", {
          count: quickStats.watchlistCount,
          defaultValue: "{{count}} companies",
        })}
      </TerminalBadge>
    </div>
  );

  const kpiTile = (
    rail: string,
    label: string,
    value: string,
    hint: string,
    valueClassName?: string,
  ) => (
    <div className={cn(TERMINAL_MODULE_PANEL, rail, "overflow-hidden")}>
      <TerminalMetricCard
        className="border-0 bg-transparent p-2 shadow-none sm:p-2.5"
        label={label}
        value={value}
        hint={hint}
        valueClassName={valueClassName}
      />
    </div>
  );

  const kpiRow = (
    <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
      {kpiTile(
        TERMINAL_ACCENT_RAIL_CYAN,
        t("dashboard.statWatchlist", { defaultValue: "Watchlist companies" }),
        hasWatchlistMetrics ? String(quickStats.watchlistCount) : noDataLabel,
        hasWatchlistMetrics
          ? t("dashboard.kpi.watchlistHint", { defaultValue: "Symbols tracked today" })
          : t("dashboard.kpi.watchlistEmpty", { defaultValue: "Add your first ticker" }),
        hasWatchlistMetrics ? "text-terminal-cyan" : undefined,
      )}
      {kpiTile(
        TERMINAL_ACCENT_RAIL_LIME,
        t("dashboard.statSignals", { defaultValue: "Active signals" }),
        hasWatchlistMetrics ? String(quickStats.signalCount) : noDataLabel,
        t("dashboard.kpi.signalsHint", {
          defaultValue: "Watchlist moves at or above ±2%",
        }),
        hasWatchlistMetrics && quickStats.signalCount > 0 ? "text-terminal-positive" : undefined,
      )}
      {kpiTile(
        TERMINAL_ACCENT_RAIL_AMBER,
        t("dashboard.kpi.eventRisk", { defaultValue: "Event risk" }),
        eventRiskKpi.value,
        eventRiskKpi.hint,
        hasWatchlistMetrics ? "text-amber-300/90" : undefined,
      )}
      {kpiTile(
        TERMINAL_ACCENT_RAIL_CYAN,
        t("dashboard.kpi.psyche", { defaultValue: "Psyche / risk state" }),
        psycheKpi.value,
        psycheKpi.hint,
        checkInState.hasCheckedIn ? "text-terminal-positive" : undefined,
      )}
    </div>
  );

  const riskStateCard = (
    <AccentPanel variant="amber" className="p-2.5 sm:p-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">
        {t("dashboard.rail.riskState", { defaultValue: "Today's risk state" })}
      </p>
      {checkInState.hasCheckedIn && checkInState.riskLevel ? (
        <div className="mt-1.5 space-y-1">
          <TerminalBadge
            variant={
              checkInState.riskLevel === "HIGH"
                ? "negative"
                : checkInState.riskLevel === "LOW"
                  ? "positive"
                  : "warning"
            }
          >
            {t(`checkin.risk.${checkInState.riskLevel}`, { defaultValue: checkInState.riskLevel })}
          </TerminalBadge>
          {checkInState.mood != null ? (
            <p className="text-[11px] text-terminal-textSecondary">
              {t("dashboard.rail.moodLogged", {
                mood: checkInState.mood,
                defaultValue: "Mood score: {{mood}}/5",
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-[11px] leading-snug text-terminal-textSecondary">
          {t("dashboard.rail.riskPending", {
            defaultValue: "Complete your daily check-in to log today's risk mindset.",
          })}
        </p>
      )}
    </AccentPanel>
  );

  return (
    <TerminalWorkspacePage
      dense
      eyebrow={t("dashboard.eyebrow", { defaultValue: "Command center" })}
      title={
        firstName
          ? t("dashboard.greeting", { name: firstName, defaultValue: "Good morning, {{name}}" })
          : t("dashboard.greetingGeneric", { defaultValue: "Welcome back" })
      }
      subtitle={todayLabel}
      status={<StatusPill variant={marketState.variant}>{marketState.label}</StatusPill>}
      actions={
        !isEmptyDashboard ? (
          <Link to="/companies" className="hidden sm:block">
            <ModuleCTAButton variant="outline" size="sm">
              {t("dashboard.companiesTitle", { defaultValue: "Companies" })}
            </ModuleCTAButton>
          </Link>
        ) : null
      }
      contentClassName="space-y-2"
      className="pb-2"
    >
      <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_292px] lg:gap-2.5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-2">
          <CockpitBand>
            {kpiRow}
            {isEmptyDashboard ? hubSetupPanel : watchlistOperationalStrip}
          </CockpitBand>

          <TerminalSection
            className={cn(TERMINAL_MODULE_PANEL, TERMINAL_ACCENT_RAIL_CYAN, "p-2.5 sm:p-3")}
            title={t("dashboard.watchlistTitle", { defaultValue: "Watchlist" })}
            actions={
              <TerminalBadge variant="default">
                {t("dashboard.watchlistCount", {
                  count: quickStats.watchlistCount,
                  defaultValue: "{{count}} companies",
                })}
              </TerminalBadge>
            }
            contentClassName="space-y-0"
          >
              {watchlistLoading ? (
                <p className="rounded-md border border-terminal-borderMuted/80 bg-terminal-bgAlt/50 px-3 py-2 text-xs text-terminal-textSecondary">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : null}

              {watchlistError ? (
                <p className="rounded-md border border-terminal-negative/30 bg-terminal-negative/10 px-3 py-2 text-xs text-terminal-negative">
                  {watchlistError}
                </p>
              ) : null}

              {!watchlistLoading && !watchlistError && watchlistRows.length === 0 ? (
                <CompactEmptyState
                  title={t("dashboard.watchlistEmptyLabel", { defaultValue: "No symbols" })}
                  message={t("watchlist.empty", {
                    defaultValue: "You are not observing any companies yet.",
                  })}
                  actions={
                    <Link to="/companies">
                      <ModuleCTAButton variant="primary" size="sm">
                        {t("dashboard.emptyWatchlistCta", { defaultValue: "Browse companies" })}
                      </ModuleCTAButton>
                    </Link>
                  }
                />
              ) : null}

              {!watchlistLoading && !watchlistError && watchlistRows.length > 0 ? (
                <TerminalTable>
                  <TerminalTableHead>
                    <tr>
                      <TerminalTableHeaderCell>
                        {t("dashboard.table.symbol", { defaultValue: "Symbol" })}
                      </TerminalTableHeaderCell>
                      <TerminalTableHeaderCell className="hidden sm:table-cell">
                        {t("dashboard.table.company", { defaultValue: "Company" })}
                      </TerminalTableHeaderCell>
                      <TerminalTableHeaderCell className="text-right">
                        {t("dashboard.table.price", { defaultValue: "Last" })}
                      </TerminalTableHeaderCell>
                      <TerminalTableHeaderCell className="text-right">
                        {t("dashboard.table.change", { defaultValue: "Change" })}
                      </TerminalTableHeaderCell>
                    </tr>
                  </TerminalTableHead>
                  <TerminalTableBody>
                    {watchlistRows.map((row) => (
                      <TerminalTableRow key={row.symbol}>
                        <TerminalTableCell>
                          <Link
                            to={`/company/${encodeURIComponent(row.symbol)}`}
                            className="flex items-center gap-2.5 font-semibold text-terminal-text transition hover:text-terminal-cyan"
                          >
                            <CompanyLogo symbol={row.symbol} logoUrl={row.logoUrl} size="sm" shape="rounded" />
                            <span className="font-mono text-xs">{row.symbol}</span>
                          </Link>
                        </TerminalTableCell>
                        <TerminalTableCell className="hidden max-w-[220px] truncate sm:table-cell">
                          {row.name}
                        </TerminalTableCell>
                        <TerminalTableCell mono className="text-right">
                          {row.close != null
                            ? formatCurrency(row.close, "USD")
                            : t("common.notAvailable", { defaultValue: "n/a" })}
                        </TerminalTableCell>
                        <TerminalTableCell className="text-right">
                          {row.changePct != null ? (
                            <MarketDelta value={row.changePct} />
                          ) : (
                            <span className="text-terminal-textMuted">—</span>
                          )}
                        </TerminalTableCell>
                      </TerminalTableRow>
                    ))}
                  </TerminalTableBody>
                </TerminalTable>
              ) : null}
            </TerminalSection>

          <div className={cn(TERMINAL_MODULE_PANEL, TERMINAL_ACCENT_RAIL_AMBER, "overflow-hidden")}>
            <EventRiskRadarWidget watchlistSymbols={watchlistSymbols} />
          </div>

          <TerminalSection
            className={cn(TERMINAL_MODULE_PANEL, TERMINAL_ACCENT_RAIL_LIME, "p-2.5 sm:p-3")}
            title={t("dashboard.signalsTitle", { defaultValue: "Recent signals" })}
            subtitle={t("dashboard.emptySignalsHint", {
              defaultValue: "Signals appear when your watchlist moves ±2% intraday.",
            })}
            contentClassName="space-y-0"
          >
              {watchlistLoading ? (
                <p className="rounded-md border border-terminal-borderMuted/80 bg-terminal-bgAlt/50 px-3 py-2 text-xs text-terminal-textSecondary">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : null}

              {!watchlistLoading && !watchlistError && latestSignals.length === 0 ? (
                <CompactEmptyState
                  title={t("dashboard.signalsWaiting", {
                    defaultValue: "No signals — the market is waiting for a setup",
                  })}
                  message={t("dashboard.emptySignalsHint", {
                    defaultValue: "Signals appear when your watchlist moves ±2% intraday.",
                  })}
                  actions={
                    <>
                      <Link to="/signals">
                        <ModuleCTAButton variant="primary" size="sm">
                          {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
                        </ModuleCTAButton>
                      </Link>
                      <Link to="/companies">
                        <ModuleCTAButton variant="secondary" size="sm">
                          {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
                        </ModuleCTAButton>
                      </Link>
                    </>
                  }
                />
              ) : null}

              {!watchlistLoading && !watchlistError && latestSignals.length > 0 ? (
                <TerminalTable>
                  <TerminalTableHead>
                    <tr>
                      <TerminalTableHeaderCell>
                        {t("dashboard.table.symbol", { defaultValue: "Symbol" })}
                      </TerminalTableHeaderCell>
                      <TerminalTableHeaderCell>
                        {t("dashboard.table.side", { defaultValue: "Side" })}
                      </TerminalTableHeaderCell>
                      <TerminalTableHeaderCell className="text-right">
                        {t("dashboard.table.move", { defaultValue: "Move" })}
                      </TerminalTableHeaderCell>
                    </tr>
                  </TerminalTableHead>
                  <TerminalTableBody>
                    {latestSignals.map((row) => {
                      const isPositive = (row.changePct ?? 0) >= 0;
                      return (
                        <TerminalTableRow key={`signal-${row.symbol}`}>
                          <TerminalTableCell>
                            <Link
                              to={`/company/${encodeURIComponent(row.symbol)}`}
                              className="flex items-center gap-2.5 transition hover:text-terminal-cyan"
                            >
                              <CompanyLogo symbol={row.symbol} logoUrl={row.logoUrl} size="sm" shape="rounded" />
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-semibold text-terminal-text">{row.symbol}</p>
                                <p className="hidden truncate text-[11px] text-terminal-textMuted sm:block">
                                  {row.name}
                                </p>
                              </div>
                            </Link>
                          </TerminalTableCell>
                          <TerminalTableCell>
                            <TerminalBadge variant={isPositive ? "positive" : "negative"}>
                              {isPositive
                                ? t("dashboard.signalLong", { defaultValue: "LONG" })
                                : t("dashboard.signalShort", { defaultValue: "SHORT" })}
                            </TerminalBadge>
                          </TerminalTableCell>
                          <TerminalTableCell className="text-right">
                            {row.changePct != null ? (
                              <MarketDelta value={row.changePct} />
                            ) : (
                              <span className="text-terminal-textMuted">—</span>
                            )}
                          </TerminalTableCell>
                        </TerminalTableRow>
                      );
                    })}
                  </TerminalTableBody>
                </TerminalTable>
              ) : null}
            </TerminalSection>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-y-auto">
          <AccentPanel variant="cyan" className="p-2 sm:p-2.5">
            <DailyCheckInWidget compact appearance="terminal" onStateChange={setCheckInState} />
          </AccentPanel>
          {riskStateCard}
          {checkInState.aiMessage ? (
            <AccentPanel variant="cyan" className="p-2.5 sm:p-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
                {t("dashboard.rail.aiBrief", { defaultValue: "AI market brief" })}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-terminal-textSecondary">
                {checkInState.aiMessage}
              </p>
              <Link to="/behavioral-coach" className="mt-1.5 inline-block">
                <TerminalButton variant="ghost" size="sm">
                  {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                </TerminalButton>
              </Link>
            </AccentPanel>
          ) : null}
        </aside>
      </div>

      <InvestmentDisclaimer
        variant="drawer"
        className="mt-2 border-terminal-borderMuted/40 bg-transparent opacity-75"
        collapsible
      />
    </TerminalWorkspacePage>
  );
}
