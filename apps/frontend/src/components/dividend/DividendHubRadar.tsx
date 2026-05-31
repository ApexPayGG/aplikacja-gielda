import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDividendGrowthScreener, type DividendGrowthRow } from "../../services/api";
import { CompanyLogo } from "../CompanyLogo";
import {
  TERMINAL_DANGER_TEXT,
  TERMINAL_DIVIDEND_ROW,
  TERMINAL_LINK_ACCENT,
  TERMINAL_DIVIDEND_TABLE,
  TERMINAL_DIVIDEND_TABLE_HEAD,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_SECTION_TITLE,
  TERMINAL_TEXT_MUTED,
} from "../terminal/terminalStyles";
import { apiErrorMessage } from "../../utils/apiErrorMessage";
import { formatDividendPerShareAmount } from "../../utils/dividendFormat";
import { formatExDateLabel, mapCompanyRow, parseDateValue } from "./dividendHubShared";

export function DividendHubRadar() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DividendGrowthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDividendGrowthScreener(3, 0, 200, 1);
      setRows(response.data);
    } catch (err) {
      setRows([]);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return rows
      .map(mapCompanyRow)
      .filter((row) => {
        if (!row.exDate || row.exDate === "-") return false;
        const ts = parseDateValue(row.exDate);
        return ts > now;
      })
      .sort((a, b) => parseDateValue(a.exDate) - parseDateValue(b.exDate))
      .slice(0, 25);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className={TERMINAL_SECTION_TITLE}>
          {t("dividendHub.radarTitle", { defaultValue: "Dividend radar" })}
        </h2>
        <p className={`mt-2 ${TERMINAL_PAGE_SUBTITLE}`}>
          {t("dividendHub.radarSubtitle", {
            defaultValue:
              "Upcoming ex-dates from synced dividend history in the growth screener universe. Full calendar view ships in a later release.",
          })}
        </p>
      </div>

      <section className={TERMINAL_DIVIDEND_TABLE}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={TERMINAL_DIVIDEND_TABLE_HEAD}>
              <tr>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnSymbol", { defaultValue: "Ticker" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnExDate", { defaultValue: "Ex-Date" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnYield", { defaultValue: "Yield %" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnDividendPerShare", { defaultValue: "Dividend / share" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividendHub.radarAction", { defaultValue: "Analyze" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-terminal-textMuted">
                    {t("common.loading", { defaultValue: "Loading..." })}
                  </td>
                </tr>
              ) : null}
              {error ? (
                <tr>
                  <td colSpan={5} className={`px-4 py-6 text-sm ${TERMINAL_DANGER_TEXT}`}>
                    {error}
                  </td>
                </tr>
              ) : null}
              {!loading && !error && upcoming.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-terminal-textMuted">
                    {t("dividendHub.radarEmpty", {
                      defaultValue:
                        "No upcoming ex-dates in the current dataset. Open the screener or dividend intelligence for per-symbol detail.",
                    })}
                  </td>
                </tr>
              ) : null}
              {!loading && !error
                ? upcoming.map((company) => (
                    <tr key={company.symbol} className={TERMINAL_DIVIDEND_ROW}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="xs" shape="rounded" />
                          <span className="font-semibold text-terminal-text">{company.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">
                        {formatExDateLabel(company.exDate)}
                      </td>
                      <td className="px-4 py-3 text-terminal-textSecondary">{company.yieldPct.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {formatDividendPerShareAmount(company.dividendPerShare, company.symbol, {
                          currency: company.currency,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/dividend/intelligence"
                          state={{ symbol: company.symbol }}
                          className={`text-xs font-semibold ${TERMINAL_LINK_ACCENT}`}
                        >
                          {t("dividendHub.radarAnalyze", { defaultValue: "Intelligence" })}
                        </Link>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className={TERMINAL_TEXT_MUTED}>
        {t("dividendHub.radarFootnote", {
          defaultValue: "Coverage depends on dividend sync symbols in the database; not a complete market calendar.",
        })}
      </p>
    </div>
  );
}
