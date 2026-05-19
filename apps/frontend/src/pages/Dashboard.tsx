import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  FireIcon,
  MinusSmallIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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

function formatChange(value: number | null): string {
  if (value == null) return "—";
  return formatPercent(value);
}

function makeFallbackLogo(symbol: string, exchange?: string | null): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
  const [baseSymbol, exchangeFromSymbol] = normalized.split(".");
  const logoExchange = (exchange ?? exchangeFromSymbol ?? "US").trim().toUpperCase();
  if (!baseSymbol || !logoExchange) return null;
  return `https://eodhd.com/img/logos/${encodeURIComponent(logoExchange)}/${encodeURIComponent(baseSymbol)}.png`;
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
      return <ArrowTrendingUpIcon className="h-4 w-4 text-positive" />;
    }
    if (tone === "down") {
      return <ArrowTrendingDownIcon className="h-4 w-4 text-negative" />;
    }
    return <MinusSmallIcon className="h-4 w-4 text-textMuted" />;
  }

  return (
    <div className="mx-auto max-w-[1400px] bg-bgPrimary px-4 py-6 dark:bg-gray-900 md:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-textPrimary md:text-3xl">
                  {firstName
                    ? t("dashboard.greeting", { name: firstName, defaultValue: "Good morning, {{name}}" })
                    : t("dashboard.greetingGeneric", { defaultValue: "Welcome back" })}
                </h1>
                <p className="mt-1 text-sm text-textSecondary">{todayLabel}</p>
              </div>
              {!isEmptyDashboard ? (
                <Link
                  to="/companies"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-textSecondary transition hover:border-brandDark hover:text-brandDark"
                >
                  {t("dashboard.companiesTitle", { defaultValue: "Companies" })}
                </Link>
              ) : null}
            </div>

            {!isEmptyDashboard ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <article key={card.label} className="rounded-xl border border-border bg-bgSecondary/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-textSecondary">{card.label}</p>
                    {trendIcon(card.trend)}
                  </div>
                  <p className="mt-2 font-mono text-3xl font-bold leading-none text-brandDark">{card.value}</p>
                </article>
              ))}
            </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold uppercase tracking-wide text-textPrimary">
                {t("dashboard.watchlistTitle", { defaultValue: "Watchlist" })}
              </h2>
              <span className="text-xs font-medium text-textSecondary">
                {t("dashboard.watchlistCount", { count: quickStats.watchlistCount, defaultValue: "{{count}} companies" })}
              </span>
            </div>

            {watchlistLoading && (
              <p className="rounded-xl border border-border bg-bgSecondary px-4 py-3 text-sm text-textSecondary">
                {t("common.loading", { defaultValue: "Loading..." })}
              </p>
            )}

            {watchlistError && (
              <p className="rounded-xl border border-negative/20 bg-negative/5 px-4 py-3 text-sm text-negative">{watchlistError}</p>
            )}

            {!watchlistLoading && !watchlistError && watchlistRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-brandDark/25 bg-gradient-to-br from-brandDark/[0.04] to-bgSecondary/80 px-5 py-6 text-center">
                <p className="text-base font-semibold text-textPrimary">
                  {t("dashboard.emptyWatchlistTitle", { defaultValue: "🔍 Find your first company" })}
                </p>
                <p className="mt-2 text-sm text-textSecondary">
                  {t("watchlist.empty", { defaultValue: "You are not observing any companies yet." })}
                </p>
                <Link
                  to="/companies"
                  className="mt-4 inline-flex rounded-lg bg-brandDark px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  {t("dashboard.emptyWatchlistCta", { defaultValue: "Browse companies" })}
                </Link>
              </div>
            )}

            {!watchlistLoading && !watchlistError && watchlistRows.length > 0 && (
              <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                {watchlistRows.map((row) => {
                  const logo = row.logoUrl ?? makeFallbackLogo(row.symbol, row.exchange);
                  const isPositive = row.changePct != null && row.changePct >= 0;
                  return (
                    <Link
                      key={row.symbol}
                      to={`/company/${encodeURIComponent(row.symbol)}`}
                      className="flex min-w-[220px] snap-start flex-col rounded-xl border border-border bg-bgSecondary/60 p-4 transition hover:-translate-y-0.5 hover:border-borderStrong hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-bgPrimary">
                            {logo ? (
                              <img src={logo} alt={`${row.name} logo`} className="h-8 w-8 object-contain" loading="lazy" />
                            ) : (
                              <BuildingOffice2Icon className="h-5 w-5 text-textMuted" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold leading-none text-brandDark">{row.symbol}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-textSecondary">{row.name}</p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.changePct == null
                              ? "bg-bgTertiary text-textMuted"
                              : isPositive
                                ? "bg-positive/10 text-positive"
                                : "bg-negative/10 text-negative"
                          }`}
                        >
                          {formatChange(row.changePct)}
                        </span>
                      </div>

                      <p className="mt-4 font-mono text-2xl font-bold text-brandDark">
                        {row.close != null ? formatCurrency(row.close, "USD") : t("common.notAvailable", { defaultValue: "n/a" })}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold uppercase tracking-wide text-textPrimary">
                {t("dashboard.signalsTitle", { defaultValue: "Recent signals" })}
              </h2>
              <FireIcon className="h-5 w-5 text-brandGold" />
            </div>

            {watchlistLoading && (
              <p className="rounded-xl border border-border bg-bgSecondary px-4 py-3 text-sm text-textSecondary">
                {t("common.loading", { defaultValue: "Loading..." })}
              </p>
            )}

            {!watchlistLoading && !watchlistError && latestSignals.length === 0 && (
              <div className="rounded-xl border border-border bg-bgSecondary/80 px-4 py-4 text-sm text-textSecondary">
                <p className="font-medium text-textPrimary">
                  {t("dashboard.signalsWaiting", { defaultValue: "No signals — the market is waiting for a setup" })}
                </p>
              </div>
            )}

            {!watchlistLoading && !watchlistError && latestSignals.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border bg-bgSecondary/40">
                {latestSignals.map((row) => {
                  const isPositive = (row.changePct ?? 0) >= 0;
                  return (
                    <li key={`signal-${row.symbol}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-brandDark">{row.symbol}</p>
                        <p className="line-clamp-1 text-xs text-textSecondary">{row.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isPositive ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                          }`}
                        >
                          {isPositive
                            ? t("dashboard.signalLong", { defaultValue: "LONG" })
                            : t("dashboard.signalShort", { defaultValue: "SHORT" })}
                        </span>
                        <span className={`text-sm font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
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
          <DailyCheckInWidget compact />
        </aside>
      </div>

      <InvestmentDisclaimer className="mt-10" collapsible />
    </div>
  );
}
