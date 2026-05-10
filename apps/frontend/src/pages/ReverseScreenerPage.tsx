import { useState } from "react";
import { useTranslation } from "react-i18next";
import { findReverseScreenerSetups, type ReverseScreenerFindResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function outcomeBadgeClass(n: number): string {
  if (n > 0.01) return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  if (n < -0.01) return "bg-rose-500/15 text-rose-200 ring-rose-500/40";
  return "bg-slate-500/15 text-slate-200 ring-slate-500/35";
}

export function ReverseScreenerPage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseScreenerFindResponse | null>(null);

  async function onFind() {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setError(t("reversescreener.errorSymbol"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await findReverseScreenerSetups({
        symbol: sym,
        ...(date.trim() ? { date: date.trim() } : {}),
      });
      setResult(data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("reversescreener.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("reversescreener.subtitle")}</p>
      </header>

      <section className="neo-panel rounded-2xl border border-brand-blue/25 p-6">
        <label className="block text-sm font-medium text-slate-300" htmlFor="rs-symbol">
          {t("reversescreener.symbolLabel")}
        </label>
        <input
          id="rs-symbol"
          className="mt-2 w-full rounded-lg border border-slate-600 bg-brand-bg px-3 py-2 text-white placeholder:text-slate-500 focus:border-brand-blue focus:outline-none"
          placeholder={t("reversescreener.symbolPlaceholder")}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          autoCapitalize="characters"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="rs-date">
          {t("reversescreener.dateLabel")}
        </label>
        <input
          id="rs-date"
          type="date"
          className="mt-2 w-full max-w-xs rounded-lg border border-slate-600 bg-brand-bg px-3 py-2 text-white focus:border-brand-blue focus:outline-none"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">{t("reversescreener.dateHint")}</p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-brand-blue px-5 py-2.5 font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:brightness-110 disabled:opacity-50"
          disabled={loading}
          onClick={() => void onFind()}
        >
          {loading ? t("common.loading") : t("reversescreener.findButton")}
        </button>
      </section>

      {error && <p className="mt-4 text-sm text-brand-red">{error}</p>}

      {result && (
        <>
          <section className="neo-panel mt-6 rounded-xl border border-brand-amber/30 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("reversescreener.avgOutcomeLabel")}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">{formatPct(result.avgOutcome)}</p>
            <p className="mt-1 text-xs text-slate-500">{t("reversescreener.avgOutcomeHint")}</p>
          </section>

          <section className="neo-panel mt-6 rounded-xl border border-slate-700 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t("reversescreener.currentSetup")}
            </h2>
            <dl className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">RSI</dt>
                <dd className="font-mono text-white">{result.currentSetup.rsi}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("reversescreener.volumeRatio")}</dt>
                <dd className="font-mono text-white">{result.currentSetup.volume}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("reversescreener.priceChange")}</dt>
                <dd className="font-mono text-white">{formatPct(result.currentSetup.priceChange)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("reversescreener.trend")}</dt>
                <dd className="font-medium capitalize text-white">
                  {t(`reversescreener.trend.${result.currentSetup.trend}`)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("reversescreener.matchesTitle")}</h2>
            {result.matches.length === 0 ? (
              <p className="text-slate-400">{t("reversescreener.noMatches")}</p>
            ) : (
              <ul className="space-y-3">
                {result.matches.map((m) => (
                  <li
                    key={`${m.symbol}-${m.date}`}
                    className="neo-panel flex flex-col gap-3 rounded-xl border border-slate-700 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-lg font-bold text-white">{m.symbol}</p>
                      <p className="text-sm text-slate-400">{m.date}</p>
                      <p className="mt-1 text-xs text-brand-blue">
                        {t("reversescreener.similarity")}: {m.similarity.toFixed(1)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${outcomeBadgeClass(m.outcome5d)}`}
                      >
                        {t("reversescreener.outcome5d", { value: formatPct(m.outcome5d) })}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${outcomeBadgeClass(m.outcome10d)}`}
                      >
                        {t("reversescreener.outcome10d", { value: formatPct(m.outcome10d) })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
