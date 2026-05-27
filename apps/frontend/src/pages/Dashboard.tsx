import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/CompanyLogo";
import { DailyCheckInWidget, type DailyCheckInWidgetState } from "../components/DailyCheckInWidget";
import { EventRiskRadarWidget } from "../components/EventRiskRadarWidget";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import {
  MarketDelta,
  StatusPill,
  TerminalBadge,
  TerminalButton,
  TerminalCard,
  TerminalMetricCard,
  TerminalPage,
  TerminalSection,
  TerminalTable,
  TerminalTableBody,
  TerminalTableCell,
  TerminalTableHead,
  TerminalTableHeaderCell,
  TerminalTableRow,
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

  const compactHero = (
    <TerminalCard variant="default" className="border-terminal-cyan/20 bg-terminal-panelSecondary/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-cyan">
            {t("dashboard.hero.eyebrow", { defaultValue: "Your StockAI hub" })}
          </p>
          <h2 className="mt-1 text-base font-bold text-terminal-text sm:text-lg">
            {t("dashboard.hero.title", { defaultValue: "Build your market watchlist" })}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-terminal-textSecondary sm:text-sm">
            {t("dashboard.hero.subtitle", {
              defaultValue:
                "Add a few tickers to unlock live quotes, movement alerts, and AI context tailored to what you actually trade.",
            })}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/companies">
          <TerminalButton variant="primary" size="sm">
            {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
          </TerminalButton>
        </Link>
        <Link to="/signals">
          <TerminalButton variant="secondary" size="sm">
            {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
          </TerminalButton>
        </Link>
        <Link to="/behavioral-coach">
          <TerminalButton variant="ghost" size="sm">
            {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
          </TerminalButton>
        </Link>
      </div>
      <div className="mt-4 border-t border-terminal-borderMuted pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-textMuted">
          {t("dashboard.hero.popularLabel", { defaultValue: "Popular to start" })}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_TICKERS.map((symbol) => (
            <Link key={symbol} to={`/company/${encodeURIComponent(symbol)}`}>
              <TerminalBadge variant="ai" className="cursor-pointer transition hover:border-terminal-cyan/60">
                {symbol}
              </TerminalBadge>
            </Link>
          ))}
        </div>
      </div>
    </TerminalCard>
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-terminal-bg via-[#070B16] to-terminal-bg">
      <TerminalPage className="w-full max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6" contentClassName="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <header className="min-w-0 border-b border-terminal-borderMuted pb-4 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-textMuted">
                  {t("dashboard.eyebrow", { defaultValue: "Command center" })}
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-terminal-text sm:text-2xl">
                  {firstName
                    ? t("dashboard.greeting", { name: firstName, defaultValue: "Good morning, {{name}}" })
                    : t("dashboard.greetingGeneric", { defaultValue: "Welcome back" })}
                </h1>
                <p className="mt-1 text-xs text-terminal-textSecondary sm:text-sm">{todayLabel}</p>
                <div className="mt-3">
                  <StatusPill variant={marketState.variant}>{marketState.label}</StatusPill>
                </div>
              </div>
              {!isEmptyDashboard ? (
                <Link to="/companies" className="hidden sm:block">
                  <TerminalButton variant="outline" size="sm">
                    {t("dashboard.companiesTitle", { defaultValue: "Companies" })}
                  </TerminalButton>
                </Link>
              ) : null}
            </div>
          </header>

          <div className="lg:col-start-2 lg:row-start-1">
            <DailyCheckInWidget compact appearance="terminal" onStateChange={setCheckInState} />
          </div>

          <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TerminalMetricCard
                label={t("dashboard.statWatchlist", { defaultValue: "Watchlist companies" })}
                value={hasWatchlistMetrics ? String(quickStats.watchlistCount) : noDataLabel}
                hint={
                  hasWatchlistMetrics
                    ? t("dashboard.kpi.watchlistHint", { defaultValue: "Symbols tracked today" })
                    : t("dashboard.kpi.watchlistEmpty", { defaultValue: "Add your first ticker" })
                }
              />
              <TerminalMetricCard
                label={t("dashboard.statSignals", { defaultValue: "Active signals" })}
                value={hasWatchlistMetrics ? String(quickStats.signalCount) : noDataLabel}
                hint={t("dashboard.kpi.signalsHint", {
                  defaultValue: "Watchlist moves at or above ±2%",
                })}
              />
              <TerminalMetricCard
                label={t("dashboard.kpi.eventRisk", { defaultValue: "Event risk" })}
                value={eventRiskKpi.value}
                hint={eventRiskKpi.hint}
              />
              <TerminalMetricCard
                label={t("dashboard.kpi.psyche", { defaultValue: "Psyche / risk state" })}
                value={psycheKpi.value}
                hint={psycheKpi.hint}
              />
            </div>

            {isEmptyDashboard ? compactHero : null}

            <TerminalSection
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
                <p className="rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/50 px-4 py-3 text-sm text-terminal-textSecondary">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : null}

              {watchlistError ? (
                <p className="rounded-lg border border-terminal-negative/30 bg-terminal-negative/10 px-4 py-3 text-sm text-terminal-negative">
                  {watchlistError}
                </p>
              ) : null}

              {!watchlistLoading && !watchlistError && watchlistRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-terminal-borderMuted bg-terminal-panelSecondary/30 px-4 py-5 text-sm">
                  <p className="text-terminal-textSecondary">
                    {t("watchlist.empty", { defaultValue: "You are not observing any companies yet." })}
                  </p>
                  <Link to="/companies" className="mt-3 inline-block">
                    <TerminalButton variant="primary" size="sm">
                      {t("dashboard.emptyWatchlistCta", { defaultValue: "Browse companies" })}
                    </TerminalButton>
                  </Link>
                </div>
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

            <EventRiskRadarWidget watchlistSymbols={watchlistSymbols} />

            <TerminalSection
              title={t("dashboard.signalsTitle", { defaultValue: "Recent signals" })}
              subtitle={t("dashboard.emptySignalsHint", {
                defaultValue: "Signals appear when your watchlist moves ±2% intraday.",
              })}
              contentClassName="space-y-0"
            >
              {watchlistLoading ? (
                <p className="rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/50 px-4 py-3 text-sm text-terminal-textSecondary">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : null}

              {!watchlistLoading && !watchlistError && latestSignals.length === 0 ? (
                <div className="rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/30 px-4 py-4 text-sm">
                  <p className="font-medium text-terminal-text">
                    {t("dashboard.signalsWaiting", {
                      defaultValue: "No signals — the market is waiting for a setup",
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to="/signals">
                      <TerminalButton variant="primary" size="sm">
                        {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
                      </TerminalButton>
                    </Link>
                    <Link to="/companies">
                      <TerminalButton variant="secondary" size="sm">
                        {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
                      </TerminalButton>
                    </Link>
                  </div>
                </div>
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

          <aside className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-2 lg:self-start">
            {checkInState.aiMessage ? (
              <TerminalCard variant="default" className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
                  {t("dashboard.rail.aiBrief", { defaultValue: "AI market brief" })}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-terminal-textSecondary">{checkInState.aiMessage}</p>
                <Link to="/behavioral-coach" className="mt-3 inline-block">
                  <TerminalButton variant="ghost" size="sm">
                    {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                  </TerminalButton>
                </Link>
              </TerminalCard>
            ) : null}

            <TerminalCard variant="default" className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-textMuted">
                {t("dashboard.rail.riskState", { defaultValue: "Today's risk state" })}
              </p>
              {checkInState.hasCheckedIn && checkInState.riskLevel ? (
                <div className="mt-3 space-y-2">
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
                    <p className="text-xs text-terminal-textSecondary">
                      {t("dashboard.rail.moodLogged", {
                        mood: checkInState.mood,
                        defaultValue: "Mood score: {{mood}}/5",
                      })}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-terminal-textSecondary">
                  {t("dashboard.rail.riskPending", {
                    defaultValue: "Complete your daily check-in to log today's risk mindset.",
                  })}
                </p>
              )}
            </TerminalCard>
          </aside>
        </div>

        <InvestmentDisclaimer variant="drawer" className="mt-6" collapsible />
      </TerminalPage>
    </div>
  );
}
