import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDividendCalendar } from "../../services/api";
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
import { formatDividendPerShareAmount } from "../../utils/dividendFormat";
import { DividendHubAccessGate } from "./DividendHubAccessGate";
import { resolveDividendHubLoadError } from "./dividendHubApiError";
import { calendarEventToRow, formatExDateLabel, type DividendCompanyRow } from "./dividendHubShared";
import { DividendDataStatusBadge, formatFrequencyLabel } from "./DividendDataStatusBadge";

function defaultCalendarRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 3);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function DividendHubRadar() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DividendCompanyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const range = useMemo(() => defaultCalendarRange(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const response = await getDividendCalendar({
        from: range.from,
        to: range.to,
        limit: 100,
      });
      setRows(response.events.map(calendarEventToRow));
    } catch (err) {
      setRows([]);
      const resolved = resolveDividendHubLoadError(err, t);
      setAccessDenied(resolved.accessDenied);
      setError(resolved.message);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className={TERMINAL_SECTION_TITLE}>
          {t("dividendHub.radarTitle", { defaultValue: "Dividend radar" })}
        </h2>
        <p className={`mt-2 ${TERMINAL_PAGE_SUBTITLE}`}>
          {t("dividendHub.radarSubtitle", {
            defaultValue:
              "Upcoming dividend events from synced database records. Dividend event detected — review dividend quality and payout risk.",
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
                  {t("dividend.columnPayDate", { defaultValue: "Pay date" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnFrequency", { defaultValue: "Payout frequency" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnYield", { defaultValue: "Yield %" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnDividendPerShare", { defaultValue: "Dividend / share" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividend.columnDataStatus", { defaultValue: "Data" })}
                </th>
                <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                  {t("dividendHub.radarAction", { defaultValue: "Analyze" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-sm text-terminal-textMuted">
                    {t("common.loading", { defaultValue: "Loading..." })}
                  </td>
                </tr>
              ) : null}
              {error ? (
                <tr>
                  <td colSpan={8}>
                    {accessDenied ? (
                      <DividendHubAccessGate message={error} />
                    ) : (
                      <p className={`px-4 py-6 text-sm ${TERMINAL_DANGER_TEXT}`}>{error}</p>
                    )}
                  </td>
                </tr>
              ) : null}
              {!loading && !error && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-sm text-terminal-textMuted">
                    {t("dividendHub.radarEmpty", {
                      defaultValue:
                        "No upcoming dividend events in this date range. Open the screener or dividend intelligence for per-symbol detail.",
                    })}
                  </td>
                </tr>
              ) : null}
              {!loading && !error
                ? rows.map((company) => (
                    <tr key={`${company.symbol}-${company.exDate}`} className={TERMINAL_DIVIDEND_ROW}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="xs" shape="rounded" />
                          <span className="font-semibold text-terminal-text">{company.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">
                        {formatExDateLabel(company.exDate)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">
                        {formatExDateLabel(company.payDate)}
                      </td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {formatFrequencyLabel(company.frequency, t)}
                      </td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {company.yieldPct > 0 ? `${company.yieldPct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {formatDividendPerShareAmount(company.dividendPerShare, company.symbol, {
                          currency: company.currency,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <DividendDataStatusBadge status={company.dataStatus} />
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
          defaultValue:
            "Educational and informational analysis only. Coverage depends on dividend sync symbols in the database; not a complete market calendar.",
        })}
      </p>
    </div>
  );
}
