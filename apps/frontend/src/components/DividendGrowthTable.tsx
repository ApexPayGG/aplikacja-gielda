import type { DividendGrowthRow } from "../services/api";
import { useTranslation } from "react-i18next";
import {
  TERMINAL_DANGER_TEXT,
  TERMINAL_DIVIDEND_ROW,
  TERMINAL_DIVIDEND_TABLE,
  TERMINAL_DIVIDEND_TABLE_HEAD,
  TERMINAL_TEXT_MUTED,
} from "../components/terminal/terminalStyles";
import { formatDividendPerShareAmount } from "../utils/dividendFormat";

interface Props {
  rows: DividendGrowthRow[];
  loading: boolean;
  error: string | null;
}

export function DividendGrowthTable({ rows, loading, error }: Props) {
  const { t } = useTranslation();
  if (loading) {
    return <p className={TERMINAL_TEXT_MUTED}>{t("common.loading")}</p>;
  }
  if (error) {
    return <p className={`text-sm ${TERMINAL_DANGER_TEXT}`}>{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className={TERMINAL_TEXT_MUTED}>
        {t("dividend.noData", { defaultValue: "No data" })}
      </p>
    );
  }

  return (
    <div className={TERMINAL_DIVIDEND_TABLE}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={TERMINAL_DIVIDEND_TABLE_HEAD}>
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colSymbol", { defaultValue: "Ticker" })}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colYear", { defaultValue: "Year" })}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colAnnual", { defaultValue: "Annual dividend" })}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colGrowth", { defaultValue: "Growth YoY %" })}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colCagr", { defaultValue: "CAGR 5Y %" })}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{t("dividend.colYield", { defaultValue: "Yield %" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className={TERMINAL_DIVIDEND_ROW}>
                <td className="px-4 py-3 font-mono font-medium text-terminal-cyan">{r.symbol}</td>
                <td className="px-4 py-3 text-terminal-textSecondary">{r.latestYear}</td>
                <td className="px-4 py-3 text-terminal-textSecondary">
                  {formatDividendPerShareAmount(r.totalAmount, r.symbol)}
                </td>
                <td className="px-4 py-3 text-terminal-textSecondary">{r.growthYoY != null ? r.growthYoY.toFixed(2) : "—"}</td>
                <td className="px-4 py-3 text-terminal-textSecondary">{r.cagr5Y != null ? r.cagr5Y.toFixed(2) : "—"}</td>
                <td className="px-4 py-3 text-terminal-textSecondary">{r.latestYield != null ? r.latestYield.toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
