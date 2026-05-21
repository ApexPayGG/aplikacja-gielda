import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  FireIcon,
  MinusSmallIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  GLASS_BTN_GHOST,
  GLASS_BTN_PRIMARY,
  GLASS_BTN_SECONDARY,
  GLASS_HERO,
  GLASS_INNER_PANEL,
  GLASS_LINK_ACCENT,
  GLASS_SECTION,
  GLASS_SECTION_TITLE,
  GLASS_STAT_CARD,
  GLASS_TEXT_NEGATIVE,
  GLASS_TEXT_POSITIVE,
  GLASS_WATCHLIST_CARD,
} from "../components/behavioral-coach/glassStyles";
import { DailyCheckInWidget } from "../components/DailyCheckInWidget";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import { useAuth } from "../context/AuthContext";
import { getCompanyDetail, getLatestQuoteBySymbol, getWatchlist } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCurrency, formatNumber, formatPercent } from "../utils/formatters";

type WatchedCompany = {
  symbol: string;
  name: string;
  exchange: string | null;
  logoUrl: string | null;
  close: number | null;
  changePct: number | null;
};

type TrendTone = "up" | "down" | "flat";

const SUGGESTED_TICKERS = ["AAPL.US", "MSFT.US", "NVDA.US"] as const;

function formatChange(value: number | null): string {
  if (value == null) return "—";
  return formatPercent(value);
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [watchlistRows, setWatchlistRows] = useState<WatchedCompany[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

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
          setWatchlistRows(enriched);
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
    const positiveMoves = watchlistRows.filter((row) => row.changePct !== null && row.changePct > 0).length;
    const validMoves = watchlistRows.filter((row) => row.changePct !== null).length;
    const winRate = validMoves > 0 ? (positiveMoves / validMoves) * 100 : 0;
    const streak = positiveMoves;
    return {
      signalCount,
      watchlistCount: watchlistRows.length,
      winRate,
      streak,
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
    return new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(
      new Date(),
    );
  }, [i18n.language, i18n.resolvedLanguage]);

  const statCards: Array<{ label: string; value: string; trend: TrendTone }> = [
    {
      label: t("dashboard.statSignals", { defaultValue: "Active signals" }),
      value: hasWatchlistMetrics ? String(quickStats.signalCount) : noDataLabel,
      trend: hasWatchlistMetrics && quickStats.signalCount > 0 ? "up" : "flat",
    },
    {
      label: t("dashboard.statWatchlist", { defaultValue: "On watchlist" }),
      value: hasWatchlistMetrics ? String(quickStats.watchlistCount) : noDataLabel,
      trend: hasWatchlistMetrics && quickStats.watchlistCount > 0 ? "up" : "flat",
    },
    {
      label: t("dashboard.statWinRate", { defaultValue: "Win rate" }),
      value: hasWatchlistMetrics ? `${formatNumber(quickStats.winRate, 1)}%` : noDataLabel,
      trend: !hasWatchlistMetrics ? "flat" : quickStats.winRate >= 50 ? "up" : "down",
    },
    {
      label: t("dashboard.statStreak", { defaultValue: "Positive streak" }),
      value: hasWatchlistMetrics ? String(quickStats.streak) : noDataLabel,
      trend: !hasWatchlistMetrics ? "flat" : quickStats.streak > 0 ? "up" : "flat",
    },
  ];

  const latestSignals = useMemo(
    () =>
      watchlistRows
        .filter((row) => row.changePct != null)
        .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
        .slice(0, 5),
    [watchlistRows],
  );

  function trendIcon(tone: TrendTone) {
    if (tone === "up") {
      return <ArrowTrendingUpIcon className={`h-4 w-4 ${GLASS_TEXT_POSITIVE}`} />;
    }
    if (tone === "down") {
      return <ArrowTrendingDownIcon className={`h-4 w-4 ${GLASS_TEXT_NEGATIVE}`} />;
    }
    return <MinusSmallIcon className="h-4 w-4 text-white/40" />;
  }

  const changeBadge = (changePct: number | null) => {
    if (changePct == null) return "bg-white/10 text-white/50";
    return changePct >= 0
      ? `bg-[#4ade80]/15 ${GLASS_TEXT_POSITIVE}`
      : `bg-[#f87171]/15 ${GLASS_TEXT_NEGATIVE}`;
  };

  return (
    <div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className={GLASS_SECTION}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {firstName
                      ? t("dashboard.greeting", { name: firstName, defaultValue: "Good morning, {{name}}" })
                      : t("dashboard.greetingGeneric", { defaultValue: "Welcome back" })}
                  </h1>
                  <p className="mt-1 text-sm text-white/60">{todayLabel}</p>
                </div>
                {!isEmptyDashboard ? (
                  <Link
                    to="/companies"
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 backdrop-blur-sm transition hover:border-[#22d3ee]/40 hover:text-[#22d3ee]"
                  >
                    {t("dashboard.companiesTitle", { defaultValue: "Companies" })}
                  </Link>
                ) : null}
              </div>

              {isEmptyDashboard ? (
                <div className={GLASS_HERO}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#22d3ee]">
                    {t("dashboard.hero.eyebrow", { defaultValue: "Your StockAI hub" })}
                  </p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
                    {t("dashboard.hero.title", { defaultValue: "Build your market watchlist" })}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
                    {t("dashboard.hero.subtitle", {
                      defaultValue:
                        "Add a few tickers to unlock live quotes, movement alerts, and AI context tailored to what you actually trade.",
                    })}
                  </p>
                  <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        t("dashboard.hero.step1", { defaultValue: "Pick companies you follow" }),
                        t("dashboard.hero.step2", { defaultValue: "Read AI briefs and signals" }),
                        t("dashboard.hero.step3", { defaultValue: "Track mindset with the coach" }),
                      ] as const
                    ).map((step, index) => (
                      <li
                        key={step}
                        className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/90 backdrop-blur-sm"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#a855f7] to-[#9333ea] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/companies" className={GLASS_BTN_PRIMARY}>
                      {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
                    </Link>
                    <Link to="/signals" className={GLASS_BTN_SECONDARY}>
                      {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
                    </Link>
                    <Link to="/behavioral-coach" className={GLASS_BTN_GHOST}>
                      {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                    </Link>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      {t("dashboard.hero.popularLabel", { defaultValue: "Popular to start" })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SUGGESTED_TICKERS.map((symbol) => (
                        <Link
                          key={symbol}
                          to={`/company/${encodeURIComponent(symbol)}`}
                          className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs font-semibold text-[#22d3ee] transition hover:border-[#22d3ee]/50 hover:bg-[#22d3ee]/10"
                        >
                          {symbol}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {statCards.map((card) => (
                    <article key={card.label} className={GLASS_STAT_CARD}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{card.label}</p>
                        {trendIcon(card.trend)}
                      </div>
                      <p className="mt-2 font-mono text-3xl font-bold leading-none text-white">{card.value}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={GLASS_SECTION}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={GLASS_SECTION_TITLE}>
                  {t("dashboard.watchlistTitle", { defaultValue: "Watchlist" })}
                </h2>
                <span className="text-xs font-medium text-white/50">
                  {t("dashboard.watchlistCount", { count: quickStats.watchlistCount, defaultValue: "{{count}} companies" })}
                </span>
              </div>

              {watchlistLoading && (
                <p className={`${GLASS_INNER_PANEL} px-4 py-3 text-sm text-white/60`}>
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              )}

              {watchlistError && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-md">
                  {watchlistError}
                </p>
              )}

              {!watchlistLoading && !watchlistError && watchlistRows.length === 0 && (
                <p className={`${GLASS_INNER_PANEL} border-dashed px-4 py-3 text-sm text-white/60`}>
                  {t("watchlist.empty", { defaultValue: "You are not observing any companies yet." })}{" "}
                  <Link to="/companies" className={GLASS_LINK_ACCENT}>
                    {t("dashboard.emptyWatchlistCta", { defaultValue: "Browse companies" })}
                  </Link>
                </p>
              )}

              {!watchlistLoading && !watchlistError && watchlistRows.length > 0 && (
                <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                  {watchlistRows.map((row) => {
                    return (
                      <Link
                        key={row.symbol}
                        to={`/company/${encodeURIComponent(row.symbol)}`}
                        className={GLASS_WATCHLIST_CARD}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#0D0D1A]/60 p-1">
                              {row.logoUrl ? (
                                <img src={row.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                              ) : (
                                <span className="text-xs font-bold text-[#22d3ee]">{row.symbol.split(".")[0]?.slice(0, 3)}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold leading-none text-white">{row.symbol}</p>
                              <p className="mt-1 line-clamp-1 text-xs text-white/50">{row.name}</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${changeBadge(row.changePct)}`}>
                            {formatChange(row.changePct)}
                          </span>
                        </div>

                        <p className="mt-4 font-mono text-2xl font-bold text-white">
                          {row.close != null ? formatCurrency(row.close, "USD") : t("common.notAvailable", { defaultValue: "n/a" })}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={GLASS_SECTION}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={GLASS_SECTION_TITLE}>
                  {t("dashboard.signalsTitle", { defaultValue: "Recent signals" })}
                </h2>
                <FireIcon className="h-5 w-5 text-amber-400" />
              </div>

              {watchlistLoading && (
                <p className={`${GLASS_INNER_PANEL} px-4 py-3 text-sm text-white/60`}>
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              )}

              {!watchlistLoading && !watchlistError && latestSignals.length === 0 && (
                <div className={`${GLASS_INNER_PANEL} px-4 py-4 text-sm`}>
                  <p className="font-medium text-white">
                    {t("dashboard.signalsWaiting", { defaultValue: "No signals — the market is waiting for a setup" })}
                  </p>
                  <p className="mt-2 text-white/60">
                    {t("dashboard.emptySignalsHint", {
                      defaultValue: "Signals appear when your watchlist moves ±2% intraday.",
                    })}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/signals" className={`${GLASS_BTN_PRIMARY} px-4 py-2 text-xs`}>
                      {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
                    </Link>
                    <Link to="/companies" className={`${GLASS_BTN_SECONDARY} px-4 py-2 text-xs`}>
                      {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
                    </Link>
                  </div>
                </div>
              )}

              {!watchlistLoading && !watchlistError && latestSignals.length > 0 && (
                <ul className={`${GLASS_INNER_PANEL} divide-y divide-white/10`}>
                  {latestSignals.map((row) => {
                    const isPositive = (row.changePct ?? 0) >= 0;
                    return (
                      <li key={`signal-${row.symbol}`} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{row.symbol}</p>
                          <p className="line-clamp-1 text-xs text-white/50">{row.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isPositive
                                ? `bg-[#4ade80]/15 ${GLASS_TEXT_POSITIVE}`
                                : `bg-[#f87171]/15 ${GLASS_TEXT_NEGATIVE}`
                            }`}
                          >
                            {isPositive
                              ? t("dashboard.signalLong", { defaultValue: "LONG" })
                              : t("dashboard.signalShort", { defaultValue: "SHORT" })}
                          </span>
                          <span
                            className={`text-sm font-semibold ${isPositive ? GLASS_TEXT_POSITIVE : GLASS_TEXT_NEGATIVE}`}
                          >
                            {formatChange(row.changePct)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <DailyCheckInWidget compact appearance="glass" />
          </aside>
        </div>

        <InvestmentDisclaimer variant="drawer" className="mt-10" collapsible />
      </div>
    </div>
  );
}
