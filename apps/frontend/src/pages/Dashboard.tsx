import { ChartBarIcon, HomeIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DailyCheckInWidget } from "../components/DailyCheckInWidget";
import { useAuth } from "../context/AuthContext";
import { getCompanyDetail, getLatestQuoteBySymbol, getWatchlist } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type WatchedCompany = {
  symbol: string;
  name: string;
  close: number | null;
  changePct: number | null;
};

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DailyCheckInWidget />
      <h1 className="text-3xl font-bold text-white">{t("dashboard.title", { defaultValue: "Dashboard" })}</h1>
      <p className="mt-2 text-sm text-slate-400">
        {t("dashboard.subtitle", {
          defaultValue: "Overview hub for StockAI Pro. Use the company browser for live data from your API.",
        })}
      </p>

      {user && (
        <section className="mt-8 rounded-2xl border border-surface-border bg-surface-elevated p-5">
          <h2 className="text-lg font-semibold text-white">
            {t("watchlist.yours", { defaultValue: "Your watchlist" })}
          </h2>
          {watchlistLoading && (
            <p className="mt-3 text-sm text-slate-400">{t("common.loading", { defaultValue: "Loading..." })}</p>
          )}
          {watchlistError && <p className="mt-3 text-sm text-red-300">{watchlistError}</p>}
          {!watchlistLoading && !watchlistError && watchlistRows.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">
              {t("watchlist.empty", { defaultValue: "You are not observing any companies yet." })}
            </p>
          )}
          {!watchlistLoading && !watchlistError && watchlistRows.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("watchlist.symbol", { defaultValue: "Symbol" })}</th>
                    <th className="px-3 py-2">{t("watchlist.lastPrice", { defaultValue: "Last price" })}</th>
                    <th className="px-3 py-2">{t("watchlist.changePct", { defaultValue: "Change %" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistRows.map((row) => (
                    <tr key={row.symbol} className="border-t border-surface-border">
                      <td className="px-3 py-2">
                        <Link to={`/company/${encodeURIComponent(row.symbol)}/premium`} className="text-accent-muted hover:underline">
                          {row.name} ({row.symbol})
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {row.close != null ? row.close.toFixed(2) : t("common.notAvailable", { defaultValue: "n/a" })}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          row.changePct == null
                            ? "text-slate-400"
                            : row.changePct >= 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                        }`}
                      >
                        {row.changePct != null ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          to="/"
          className="flex items-start gap-4 rounded-2xl border border-surface-border bg-surface-elevated p-5 transition hover:border-accent/40"
        >
          <HomeIcon className="h-8 w-8 shrink-0 text-accent-muted" />
          <div>
            <h2 className="font-semibold text-white">{t("dashboard.companiesTitle", { defaultValue: "Companies" })}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("dashboard.companiesDesc", { defaultValue: "Search and sector grid with logos." })}
            </p>
          </div>
        </Link>

        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-surface-border bg-slate-900/30 p-5 opacity-80">
          <ChartBarIcon className="h-8 w-8 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-400">{t("dashboard.signalsTitle", { defaultValue: "Signals" })}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.signalsDesc", { defaultValue: "Coming soon — screener & AI scores." })}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-surface-border bg-slate-900/30 p-5 opacity-80 sm:col-span-2">
          <Squares2X2Icon className="h-8 w-8 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-400">{t("dashboard.portfolioTitle", { defaultValue: "Portfolio" })}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.portfolioDesc", { defaultValue: "Coming soon — watchlists and alerts." })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
