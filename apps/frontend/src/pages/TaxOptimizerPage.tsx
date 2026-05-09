import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatPlnAndUsd, localeTagForLanguage } from "../utils/money";

const USER_ID = "demo-user";

type TaxSuggestion = {
  type: string;
  message: string;
  potentialSaving?: number;
  ticker?: string;
  lossValue?: number;
};

type TaxResponse = {
  year: number;
  totalGains: number;
  totalLosses: number;
  netIncome: number;
  taxBase: number;
  taxAmount: number;
  alreadyPaid: number;
  taxToPay: number;
  trades: Array<{ ticker: string; openDate: string; closeDate: string; pnl: number; pnlPct: number }>;
  suggestions: TaxSuggestion[];
};

function yearOptions(center: number): number[] {
  const out: number[] = [];
  for (let y = center + 1; y >= center - 6; y--) out.push(y);
  return out;
}

export function TaxOptimizerPage() {
  const { t, i18n } = useTranslation();
  const defaultYear = new Date().getFullYear();
  const [year, setYear] = useState(defaultYear);
  const [data, setData] = useState<TaxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fmt = useCallback((n: number) => formatPlnAndUsd(n, i18n.language), [i18n.language]);
  const locale = localeTagForLanguage(i18n.language);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await api.get<TaxResponse>(`/tax/${encodeURIComponent(USER_ID)}`, {
        params: { year },
      });
      setData(body);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(() => yearOptions(defaultYear), [defaultYear]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t("taxOptimizer.title")}</h1>
          <p className="mt-2 max-w-2xl text-xs text-slate-500">{t("money.gpwCaption")}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("taxOptimizer.year")}</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && <p className="text-slate-400">{t("common.loading")}</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("taxOptimizer.grossGains")}</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-green">{fmt(data.totalGains)}</div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("taxOptimizer.losses")}</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-red">{fmt(data.totalLosses)}</div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("taxOptimizer.netIncome")}</div>
              <div
                className={`mt-2 font-mono text-xl font-semibold ${data.netIncome >= 0 ? "text-brand-green" : "text-brand-red"}`}
              >
                {data.netIncome < 0 ? "−" : ""}
                {fmt(Math.abs(data.netIncome))}
              </div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("taxOptimizer.tax19")}</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-amber">{fmt(data.taxAmount)}</div>
              <div className="mt-1 text-[10px] text-slate-500">{t("taxOptimizer.alreadyPaid", { amount: fmt(data.alreadyPaid) })}</div>
            </div>
            <div className="neo-panel rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-4 sm:col-span-2 lg:col-span-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">{t("taxOptimizer.toPay")}</div>
              <div className="mt-2 font-mono text-2xl font-bold text-brand-amber">{fmt(data.taxToPay)}</div>
            </div>
          </div>

          {data.netIncome < 0 && <p className="mb-6 text-sm text-slate-400">{t("taxOptimizer.netLossTaxNote")}</p>}

          {data.suggestions.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-white">{t("taxOptimizer.suggestionsTitle")}</h2>
              <ul className="space-y-3">
                {data.suggestions.map((s, i) => (
                  <li
                    key={`${s.type}-${i}`}
                    className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-amber-50"
                  >
                    {s.type === "CLOSE_LOSS_BEFORE_YEAR_END"
                      ? t("taxOptimizer.suggestions.CLOSE_LOSS_BEFORE_YEAR_END", {
                          ticker: s.ticker ?? "",
                          value: s.lossValue != null ? s.lossValue.toFixed(2) : "",
                          saving: s.potentialSaving != null ? s.potentialSaving.toFixed(2) : "",
                          defaultValue: s.message,
                        })
                      : t(`taxOptimizer.suggestions.${s.type}`, { defaultValue: s.message })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="neo-panel overflow-x-auto rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("taxOptimizer.closedTrades")}</h2>
            {data.trades.length === 0 ? (
              <p className="text-sm text-slate-500">{t("taxOptimizer.noTrades")}</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">{t("taxOptimizer.colTicker")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colOpen")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colClose")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colPnl")}</th>
                    <th className="py-2">{t("taxOptimizer.colPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((r) => (
                    <tr key={`${r.ticker}-${r.closeDate}`} className="border-b border-white/5 font-mono text-slate-200">
                      <td className="py-2 pr-4 font-semibold text-white">{r.ticker}</td>
                      <td className="py-2 pr-4 text-xs text-slate-400">
                        {new Date(r.openDate).toLocaleDateString(locale)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-400">
                        {new Date(r.closeDate).toLocaleDateString(locale)}
                      </td>
                      <td className={`py-2 pr-4 ${r.pnl >= 0 ? "text-brand-green" : "text-brand-red"}`}>{fmt(r.pnl)}</td>
                      <td className={`py-2 ${r.pnlPct >= 0 ? "text-brand-green" : "text-brand-red"}`}>{r.pnlPct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="mt-8 text-xs leading-relaxed text-slate-500">{t("taxOptimizer.disclaimer")}</p>
        </>
      )}
    </div>
  );
}
