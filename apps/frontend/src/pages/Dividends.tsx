import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DividendGrowthTable } from "../components/DividendGrowthTable";
import { TaxCalculatorPL } from "../components/TaxCalculatorPL";
import type { DividendGrowthRow, DividendHistoryItem } from "../services/api";
import { formatDividendPerShareAmount } from "../utils/dividendFormat";
import { getDividendHistory, getDividendGrowthScreener } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_DANGER_TEXT,
  TERMINAL_DIVIDEND_PAGE,
  TERMINAL_DIVIDEND_PAGE_INNER,
  TERMINAL_DIVIDEND_PANEL,
  TERMINAL_DIVIDEND_ROW,
  TERMINAL_DIVIDEND_TABLE,
  TERMINAL_DIVIDEND_TABLE_HEAD,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TEXT_MUTED,
} from "../components/terminal/terminalStyles";

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
    <div className={TERMINAL_DIVIDEND_PAGE}>
      <div className={TERMINAL_DIVIDEND_PAGE_INNER}>
        <header className="mb-10">
          <h1 className={TERMINAL_PAGE_TITLE}>
            {t("dividend.title", { defaultValue: "Dividend screening" })}
          </h1>
        </header>

        <section className={`${TERMINAL_DIVIDEND_PANEL} mb-12`}>
          <h2 className="text-xl font-semibold text-terminal-text">
            {t("dividend.history", { defaultValue: "Dividend history" })}
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("dividend.symbol", { defaultValue: "Ticker" })}</span>
              <input
                className={`${TERMINAL_INPUT} mt-1 font-mono`}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              />
            </label>
            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("dividend.yearsBack", { defaultValue: "Years back" })}</span>
              <input
                type="number"
                min={1}
                max={30}
                className={`${TERMINAL_INPUT} mt-1 w-24`}
                value={years}
                onChange={(e) => setYears(parseInt(e.target.value, 10) || 5)}
              />
            </label>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className={TERMINAL_BUTTON_PRIMARY}
            >
              {t("dividend.fetch", { defaultValue: "Fetch" })}
            </button>
          </div>
          {histLoading && <p className={`mt-4 ${TERMINAL_TEXT_MUTED}`}>{t("common.loading")}</p>}
          {histError && <p className={`mt-4 text-sm ${TERMINAL_DANGER_TEXT}`}>{histError}</p>}
          {!histLoading && !histError && history.length > 0 && (
            <div className={`${TERMINAL_DIVIDEND_TABLE} mt-4`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className={TERMINAL_DIVIDEND_TABLE_HEAD}>
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividendsPage.exDate", { defaultValue: "Ex-date" })}</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividendsPage.payDate", { defaultValue: "Pay date" })}</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividendsPage.amount", { defaultValue: "Amount" })}</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividendsPage.yield", { defaultValue: "Yield %" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => (
                      <tr key={`${r.exDate}-${i}`} className={TERMINAL_DIVIDEND_ROW}>
                        <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">{r.exDate}</td>
                        <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">{r.payDate}</td>
                        <td className="px-4 py-3 text-terminal-textSecondary">{formatDividendPerShareAmount(r.amount, symbol)}</td>
                        <td className="px-4 py-3 text-terminal-textSecondary">{r.yield != null ? r.yield : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!histLoading && !histError && history.length === 0 && (
            <p className={`mt-4 ${TERMINAL_TEXT_MUTED}`}>{t("dividend.noData", { defaultValue: "No data" })}</p>
          )}
        </section>

        <section className={`${TERMINAL_DIVIDEND_PANEL} mb-12`}>
          <h2 className="text-xl font-semibold text-terminal-text">
            {t("dividend.screener", { defaultValue: "Screener: dividend growth (CAGR)" })}
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>
                {t("dividend.minYears", { defaultValue: "Min. years of history" })}
              </span>
              <input
                type="number"
                min={1}
                max={30}
                className={`${TERMINAL_INPUT} mt-1 w-24`}
                value={minYears}
                onChange={(e) => setMinYears(parseInt(e.target.value, 10) || 5)}
              />
            </label>
            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>{t("dividend.minYield", { defaultValue: "Min. yield %" })}</span>
              <input
                type="number"
                min={0}
                step="0.1"
                className={`${TERMINAL_INPUT} mt-1 w-24`}
                value={minYield}
                onChange={(e) => setMinYield(parseFloat(e.target.value) || 0)}
              />
            </label>
            <button
              type="button"
              onClick={() => void loadGrowth()}
              className={TERMINAL_BUTTON_SECONDARY}
            >
              {t("dividend.refresh", { defaultValue: "Refresh" })}
            </button>
          </div>
          <div className="mt-4">
            <DividendGrowthTable rows={growthRows} loading={growthLoading} error={growthError} />
          </div>
        </section>

        <section className={TERMINAL_DIVIDEND_PANEL}>
          <TaxCalculatorPL />
        </section>
      </div>
    </div>
  );
}
