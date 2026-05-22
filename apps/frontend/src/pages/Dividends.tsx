import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DividendGrowthTable } from "../components/DividendGrowthTable";
import { TaxCalculatorPL } from "../components/TaxCalculatorPL";
import type { DividendGrowthRow, DividendHistoryItem } from "../services/api";
import { formatDividendPerShareAmount } from "../utils/dividendFormat";
import { getDividendHistory, getDividendGrowthScreener } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function Dividends() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("AAPL");
  const [years, setYears] = useState(5);
  const [history, setHistory] = useState<DividendHistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  const [minYears, setMinYears] = useState(5);
  const [minYield, setMinYield] = useState(3);
  const [growthRows, setGrowthRows] = useState<DividendGrowthRow[]>([]);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthError, setGrowthError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setHistError(null);
    try {
      const res = await getDividendHistory(symbol.trim(), years);
      setHistory(res.data);
    } catch (e) {
      setHistError(apiErrorMessage(e));
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [symbol, years]);

  const loadGrowth = useCallback(async () => {
    setGrowthLoading(true);
    setGrowthError(null);
    try {
      const res = await getDividendGrowthScreener(minYears, minYield, 50, 1);
      setGrowthRows(res.data);
    } catch (e) {
      setGrowthError(apiErrorMessage(e));
      setGrowthRows([]);
    } finally {
      setGrowthLoading(false);
    }
  }, [minYears, minYield]);

  useEffect(() => {
    void loadGrowth();
  }, [loadGrowth]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {t("dividend.title", { defaultValue: "Dividend screening" })}
        </h1>
      </header>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white">
          {t("dividend.history", { defaultValue: "Dividend history" })}
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="text-slate-400">{t("dividend.symbol", { defaultValue: "Symbol" })}</span>
            <input
              className="mt-1 block rounded-md border border-surface-border bg-surface px-3 py-2 font-mono text-white"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-400">{t("dividend.yearsBack", { defaultValue: "Years back" })}</span>
            <input
              type="number"
              min={1}
              max={30}
              className="mt-1 block w-24 rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
              value={years}
              onChange={(e) => setYears(parseInt(e.target.value, 10) || 5)}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t("dividend.fetch", { defaultValue: "Fetch" })}
          </button>
        </div>
        {histLoading && <p className="mt-4 text-sm text-slate-400">{t("common.loading")}</p>}
        {histError && <p className="mt-4 text-sm text-red-400">{histError}</p>}
        {!histLoading && !histError && history.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-surface-border">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-surface-elevated text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("dividendsPage.exDate", { defaultValue: "Ex-date" })}</th>
                  <th className="px-4 py-3">{t("dividendsPage.payDate", { defaultValue: "Pay date" })}</th>
                  <th className="px-4 py-3">{t("dividendsPage.amount", { defaultValue: "Amount" })}</th>
                  <th className="px-4 py-3">{t("dividendsPage.yield", { defaultValue: "Yield %" })}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={`${r.exDate}-${i}`} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-mono text-xs">{r.exDate}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.payDate}</td>
                    <td className="px-4 py-3">{formatDividendPerShareAmount(r.amount, symbol)}</td>
                    <td className="px-4 py-3">{r.yield != null ? r.yield : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!histLoading && !histError && history.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">{t("dividend.noData", { defaultValue: "No data" })}</p>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-white">
          {t("dividend.screener", { defaultValue: "Screener: dividend growth (CAGR)" })}
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="text-slate-400">
              {t("dividend.minYears", { defaultValue: "Min. years of history" })}
            </span>
            <input
              type="number"
              min={1}
              max={30}
              className="mt-1 block w-24 rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
              value={minYears}
              onChange={(e) => setMinYears(parseInt(e.target.value, 10) || 5)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-400">{t("dividend.minYield", { defaultValue: "Min. yield %" })}</span>
            <input
              type="number"
              min={0}
              step="0.1"
              className="mt-1 block w-24 rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
              value={minYield}
              onChange={(e) => setMinYield(parseFloat(e.target.value) || 0)}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadGrowth()}
            className="rounded-md border border-surface-border px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            {t("dividend.refresh", { defaultValue: "Refresh" })}
          </button>
        </div>
        <div className="mt-4">
          <DividendGrowthTable rows={growthRows} loading={growthLoading} error={growthError} />
        </div>
      </section>

      <section>
        <TaxCalculatorPL />
      </section>
    </div>
  );
}
