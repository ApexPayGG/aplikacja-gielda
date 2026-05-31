import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDividendCalendar } from "../../services/api";
import { CompanyLogo } from "../CompanyLogo";
import {
  EmptyStatePanel,
  SectionEyebrow,
  TerminalDataTable,
  TerminalDataTableBody,
  TerminalDataTableCell,
  TerminalDataTableHead,
  TerminalDataTableHeaderCell,
  TerminalDataTableRow,
} from "../terminal";
import { TERMINAL_DANGER_TEXT, TERMINAL_LINK_ACCENT, TERMINAL_TEXT_MUTED } from "../terminal/terminalStyles";
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
        <SectionEyebrow accent>
          {t("dividendHub.radarTitle", { defaultValue: "Dividend radar" })}
        </SectionEyebrow>
        <p className={`mt-2 text-xs leading-relaxed text-terminal-textSecondary sm:text-sm`}>
          {t("dividendHub.radarSubtitle", {
            defaultValue:
              "Upcoming dividend events from synced database records. Dividend event detected — review dividend quality and payout risk.",
          })}
        </p>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-terminal-textMuted">
          {t("common.loading", { defaultValue: "Loading..." })}
        </p>
      ) : null}

      {error ? (
        accessDenied ? (
          <DividendHubAccessGate message={error} />
        ) : (
          <p className={`py-4 text-sm ${TERMINAL_DANGER_TEXT}`}>{error}</p>
        )
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyStatePanel
          message={t("dividendHub.radarEmpty", {
            defaultValue:
              "No upcoming dividend events in this date range. Open the screener or dividend intelligence for per-symbol detail.",
          })}
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <TerminalDataTable>
          <TerminalDataTableHead>
            <tr>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnSymbol", { defaultValue: "Ticker" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnExDate", { defaultValue: "Ex-Date" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnPayDate", { defaultValue: "Pay date" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnFrequency", { defaultValue: "Payout frequency" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnYield", { defaultValue: "Yield %" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnDividendPerShare", { defaultValue: "Dividend / share" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividend.columnDataStatus", { defaultValue: "Data" })}
              </TerminalDataTableHeaderCell>
              <TerminalDataTableHeaderCell>
                {t("dividendHub.radarAction", { defaultValue: "Analyze" })}
              </TerminalDataTableHeaderCell>
            </tr>
          </TerminalDataTableHead>
          <TerminalDataTableBody>
            {rows.map((company) => (
              <TerminalDataTableRow key={`${company.symbol}-${company.exDate}`}>
                <TerminalDataTableCell>
                  <div className="flex items-center gap-2">
                    <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="xs" shape="rounded" />
                    <span className="font-semibold text-terminal-text">{company.symbol}</span>
                  </div>
                </TerminalDataTableCell>
                <TerminalDataTableCell mono>{formatExDateLabel(company.exDate)}</TerminalDataTableCell>
                <TerminalDataTableCell mono>{formatExDateLabel(company.payDate)}</TerminalDataTableCell>
                <TerminalDataTableCell>{formatFrequencyLabel(company.frequency, t)}</TerminalDataTableCell>
                <TerminalDataTableCell mono>
                  {company.yieldPct > 0 ? `${company.yieldPct.toFixed(2)}%` : "—"}
                </TerminalDataTableCell>
                <TerminalDataTableCell>
                  {formatDividendPerShareAmount(company.dividendPerShare, company.symbol, {
                    currency: company.currency,
                  })}
                </TerminalDataTableCell>
                <TerminalDataTableCell>
                  <DividendDataStatusBadge status={company.dataStatus} />
                </TerminalDataTableCell>
                <TerminalDataTableCell>
                  <Link
                    to="/dividend/intelligence"
                    state={{ symbol: company.symbol }}
                    className={`text-xs font-semibold ${TERMINAL_LINK_ACCENT}`}
                  >
                    {t("dividendHub.radarAnalyze", { defaultValue: "Intelligence" })}
                  </Link>
                </TerminalDataTableCell>
              </TerminalDataTableRow>
            ))}
          </TerminalDataTableBody>
        </TerminalDataTable>
      ) : null}

      <p className={TERMINAL_TEXT_MUTED}>
        {t("dividendHub.radarFootnote", {
          defaultValue:
            "Educational and informational analysis only. Coverage depends on dividend sync symbols in the database; not a complete market calendar.",
        })}
      </p>
    </div>
  );
}
