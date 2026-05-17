import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DailyCheckInWidget } from "../components/DailyCheckInWidget";
import { useAuth } from "../context/AuthContext";
import { getCompanyDetail, getLatestQuoteBySymbol, getWatchlist } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type WatchedCompany = {
  symbol: string;
  name: string;
  exchange: string | null;
  logoUrl: string | null;
  close: number | null;
  changePct: number | null;
};

function makeFallbackLogo(symbol: string, exchange?: string | null): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
  const [baseSymbol, exchangeFromSymbol] = normalized.split(".");
  const logoExchange = (exchange ?? exchangeFromSymbol ?? "US").trim().toUpperCase();
  if (!baseSymbol || !logoExchange) return null;
  return `https://eodhd.com/img/logos/${encodeURIComponent(logoExchange)}/${encodeURIComponent(baseSymbol)}.png`;
}

export function Dashboard() {
  const { t } = useTranslation();
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
    const portfolioValue = watchlistRows.reduce((total, row) => total + (row.close ?? 0), 0);
    const positiveMoves = watchlistRows.filter((row) => row.changePct !== null && row.changePct > 0).length;
    const validMoves = watchlistRows.filter((row) => row.changePct !== null).length;
    const winRate = validMoves > 0 ? (positiveMoves / validMoves) * 100 : 0;
    const streak = positiveMoves;
    return {
      signalCount,
      portfolioValue,
      winRate,
      streak,
    };
  }, [watchlistRows]);

  return (
    <div className="mx-auto max-w-7xl bg-bgPrimary px-4 py-8 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">{t("dashboard.title", { defaultValue: "Dashboard" })}</h1>
          <p className="mt-2 max-w-2xl text-sm text-textSecondary">
            {t("dashboard.subtitle", {
              defaultValue: "Overview hub for StockAI Pro. Use the company browser for live data from your API.",
            })}
          </p>
        </div>
        <div className="w-full max-w-sm justify-self-end">
          <DailyCheckInWidget compact />
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Liczba sygnałów</p>
          <p className="mt-2 font-mono text-3xl font-bold text-brandDark">{quickStats.signalCount}</p>
        </article>
        <article className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Wartość portfolio</p>
          <p className="mt-2 font-mono text-3xl font-bold text-brandDark">${quickStats.portfolioValue.toFixed(2)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Win rate</p>
          <p className="mt-2 font-mono text-3xl font-bold text-brandDark">{quickStats.winRate.toFixed(1)}%</p>
        </article>
        <article className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Streak</p>
          <p className="mt-2 font-mono text-3xl font-bold text-brandDark">{quickStats.streak}</p>
        </article>
      </section>

      {user && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-textPrimary">{t("watchlist.yours", { defaultValue: "Your watchlist" })}</h2>
            <Link to="/" className="text-sm font-semibold text-brandDark hover:underline">
              {t("dashboard.companiesTitle", { defaultValue: "Companies" })}
            </Link>
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
            <p className="rounded-xl border border-border bg-bgSecondary px-4 py-3 text-sm text-textSecondary">
              {t("watchlist.empty", { defaultValue: "You are not observing any companies yet." })}
            </p>
          )}

          {!watchlistLoading && !watchlistError && watchlistRows.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {watchlistRows.map((row) => {
                const logo = row.logoUrl ?? makeFallbackLogo(row.symbol, row.exchange);
                return (
                  <Link
                    key={row.symbol}
                    to={`/company/${encodeURIComponent(row.symbol)}/premium`}
                    className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-bgSecondary">
                          {logo ? (
                            <img src={logo} alt={`${row.name} logo`} className="h-10 w-10 object-contain" loading="lazy" />
                          ) : (
                            <BuildingOffice2Icon className="h-7 w-7 text-textMuted" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-brandDark">{row.symbol}</p>
                          <p className="line-clamp-1 text-xs text-textMuted">{row.name}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.changePct == null
                            ? "bg-bgTertiary text-textMuted"
                            : row.changePct >= 0
                              ? "bg-positive/10 text-positive"
                              : "bg-negative/10 text-negative"
                        }`}
                      >
                        {row.changePct != null ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    <p className="font-mono text-3xl font-bold text-brandDark">
                      {row.close != null ? row.close.toFixed(2) : t("common.notAvailable", { defaultValue: "n/a" })}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
