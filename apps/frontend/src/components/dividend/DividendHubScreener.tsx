import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExportButton } from "../ExportButton";
import { useAuth } from "../../context/AuthContext";
import { getDividendGrowthScreener, type DividendGrowthRow } from "../../services/api";
import { CompanyLogo } from "../CompanyLogo";
import {
  TERMINAL_DANGER_TEXT,
  TERMINAL_DIVIDEND_BADGE,
  TERMINAL_DIVIDEND_PANEL,
  TERMINAL_DIVIDEND_ROW,
  TERMINAL_DIVIDEND_TABLE,
  TERMINAL_DIVIDEND_TABLE_HEAD,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_SUCCESS_TEXT,
} from "../terminal/terminalStyles";
import { colors } from "../../styles/designSystem";
import { DividendHubAccessGate } from "./DividendHubAccessGate";
import { resolveDividendHubLoadError } from "./dividendHubApiError";
import { formatDividendPerShareAmount } from "../../utils/dividendFormat";
import { mapCompanyRow, parseDateValue, type DividendCompanyRow } from "./dividendHubShared";
import { DividendDataStatusBadge, formatFrequencyLabel } from "./DividendDataStatusBadge";

const FREQUENCY_FILTER_VALUES = ["", "quarterly", "monthly", "annual", "semi_annual"] as const;

type SortKey = "symbol" | "name" | "yieldPct" | "healthScore" | "exDate" | "dividendPerShare" | "frequency";
type SortDirection = "asc" | "desc";

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function healthColor(score: number): string {
  if (score > 70) return colors.positive;
  if (score >= 40) return colors.brandGold;
  return colors.negative;
}

export function DividendHubScreener() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<DividendGrowthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [yieldMin, setYieldMin] = useState("");
  const [yieldMax, setYieldMax] = useState("");
  const [sector, setSector] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState<(typeof FREQUENCY_FILTER_VALUES)[number]>("");
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("yieldPct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const response = await getDividendGrowthScreener(
        3,
        0,
        200,
        1,
        frequencyFilter || undefined,
      );
      setRows(response.data);
    } catch (err) {
      setRows([]);
      const resolved = resolveDividendHubLoadError(err, t);
      setAccessDenied(resolved.accessDenied);
      setError(resolved.message);
    } finally {
      setLoading(false);
    }
  }, [frequencyFilter, t]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const companies = useMemo(() => rows.map(mapCompanyRow), [rows]);

  const sectors = useMemo(() => {
    return Array.from(new Set(companies.map((company) => company.sector))).sort((a, b) => a.localeCompare(b));
  }, [companies]);

  const filteredAndSorted = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    const min = yieldMin.trim() === "" ? null : Number(yieldMin);
    const max = yieldMax.trim() === "" ? null : Number(yieldMax);

    const filtered = companies.filter((company) => {
      const matchesQuery =
        normalizedQuery === "" ||
        company.symbol.toLowerCase().includes(normalizedQuery) ||
        company.name.toLowerCase().includes(normalizedQuery);
      const matchesSector = sector === "all" || company.sector === sector;
      const matchesMin = min == null || Number.isNaN(min) ? true : company.yieldPct >= min;
      const matchesMax = max == null || Number.isNaN(max) ? true : company.yieldPct <= max;
      return matchesQuery && matchesSector && matchesMin && matchesMax;
    });

    return [...filtered].sort((left, right) => {
      const directionFactor = sortDirection === "asc" ? 1 : -1;
      const leftValue =
        sortKey === "exDate"
          ? parseDateValue(left.exDate)
          : sortKey === "frequency"
            ? (left.frequency ?? "").toLowerCase()
            : sortKey === "symbol" || sortKey === "name"
              ? left[sortKey].toLowerCase()
              : left[sortKey] ?? 0;
      const rightValue =
        sortKey === "exDate"
          ? parseDateValue(right.exDate)
          : sortKey === "frequency"
            ? (right.frequency ?? "").toLowerCase()
            : sortKey === "symbol" || sortKey === "name"
              ? right[sortKey].toLowerCase()
              : right[sortKey] ?? 0;

      if (leftValue < rightValue) return -1 * directionFactor;
      if (leftValue > rightValue) return 1 * directionFactor;
      return 0;
    });
  }, [companies, search, sector, sortDirection, sortKey, yieldMax, yieldMin]);

  function onSort(nextKey: SortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "symbol" || nextKey === "name" || nextKey === "exDate" ? "asc" : "desc");
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <ExportButton
          endpoint="/export/dividend"
          userId={user?.id}
          label={t("dividend.exportLabel", { defaultValue: "Export dividends" })}
        />
      </div>

      <section className={TERMINAL_DIVIDEND_PANEL}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">
            <span className={TERMINAL_FORM_LABEL}>{t("dividend.searchLabel", { defaultValue: "Search" })}</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dividend.searchPlaceholder", { defaultValue: "Symbol or company name" })}
              className={`${TERMINAL_INPUT} mt-1`}
            />
          </label>

          <label className="text-sm">
            <span className={TERMINAL_FORM_LABEL}>{t("dividend.yieldMin", { defaultValue: "Min yield %" })}</span>
            <input
              type="number"
              value={yieldMin}
              onChange={(event) => setYieldMin(event.target.value)}
              min={0}
              step={0.1}
              className={`${TERMINAL_INPUT} mt-1`}
            />
          </label>

          <label className="text-sm">
            <span className={TERMINAL_FORM_LABEL}>{t("dividend.yieldMax", { defaultValue: "Max yield %" })}</span>
            <input
              type="number"
              value={yieldMax}
              onChange={(event) => setYieldMax(event.target.value)}
              min={0}
              step={0.1}
              className={`${TERMINAL_INPUT} mt-1`}
            />
          </label>

          <label className="text-sm">
            <span className={TERMINAL_FORM_LABEL}>{t("dividend.sector", { defaultValue: "Sector" })}</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)} className={`${TERMINAL_INPUT} mt-1`}>
              <option value="all">{t("dividend.sectorAll", { defaultValue: "All" })}</option>
              {sectors.map((sectorName) => (
                <option key={sectorName} value={sectorName}>
                  {sectorName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("dividend.frequencyFilter", { defaultValue: "Payout frequency" })}
            </span>
            <select
              value={frequencyFilter}
              onChange={(event) =>
                setFrequencyFilter(event.target.value as (typeof FREQUENCY_FILTER_VALUES)[number])
              }
              className={`${TERMINAL_INPUT} mt-1`}
            >
              <option value="">{t("dividend.frequencyAll", { defaultValue: "All" })}</option>
              {FREQUENCY_FILTER_VALUES.filter((v) => v).map((value) => (
                <option key={value} value={value}>
                  {formatFrequencyLabel(value, t)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <ScreenerTable
        loading={loading}
        error={error}
        accessDenied={accessDenied}
        rows={filteredAndSorted}
        hoveredSymbol={hoveredSymbol}
        onHover={setHoveredSymbol}
        onSort={onSort}
        sortIndicator={sortIndicator}
        t={t}
      />
    </div>
  );
}

function ScreenerTable({
  loading,
  error,
  accessDenied,
  rows,
  hoveredSymbol,
  onHover,
  onSort,
  sortIndicator,
  t,
}: {
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
  rows: DividendCompanyRow[];
  hoveredSymbol: string | null;
  onHover: (symbol: string | null) => void;
  onSort: (key: SortKey) => void;
  sortIndicator: (key: SortKey) => string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <section className={TERMINAL_DIVIDEND_TABLE}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={TERMINAL_DIVIDEND_TABLE_HEAD}>
            <tr>
              {(
                [
                  ["symbol", "dividend.columnSymbol", "Ticker"],
                  ["name", "dividend.columnName", "Name"],
                  ["yieldPct", "dividend.columnYield", "Yield %"],
                  ["healthScore", "dividend.columnHealth", "Health Score"],
                  ["exDate", "dividend.columnExDate", "Ex-Date"],
                  ["frequency", "dividend.columnFrequency", "Payout frequency"],
                  ["dividendPerShare", "dividend.columnDividendPerShare", "Dividend / share"],
                ] as const
              ).map(([key, labelKey, fallback]) => (
                <th key={key} className="px-4 py-3">
                  <button
                    type="button"
                    className="font-semibold text-terminal-textMuted transition hover:text-terminal-text"
                    onClick={() => onSort(key)}
                  >
                    {t(labelKey, { defaultValue: fallback })}
                    {sortIndicator(key)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-terminal-textMuted">
                {t("dividend.columnDataStatus", { defaultValue: "Data" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-sm text-terminal-textMuted" colSpan={8}>
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
                <td className="px-4 py-6 text-sm text-terminal-textMuted" colSpan={8}>
                  {t("dividend.noResults", { defaultValue: "No results for the selected filters." })}
                </td>
              </tr>
            ) : null}
            {!loading && !error
              ? rows.map((company) => {
                  const currentHealthColor = healthColor(company.healthScore);
                  const isHovered = hoveredSymbol === company.symbol;
                  return (
                    <tr
                      key={company.symbol}
                      className={`${TERMINAL_DIVIDEND_ROW} ${isHovered ? "bg-terminal-panelSecondary/70" : ""}`}
                      onMouseEnter={() => onHover(company.symbol)}
                      onMouseLeave={() => onHover(null)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CompanyLogo symbol={company.symbol} logoUrl={company.logoUrl} size="xs" shape="rounded" />
                          <span className="font-semibold text-terminal-text">{company.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-terminal-text">{company.name}</p>
                          <p className="text-xs text-terminal-textMuted">{company.sector}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={TERMINAL_DIVIDEND_BADGE}>{formatPercent(company.yieldPct)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full rounded-full bg-terminal-panelSecondary">
                            <div
                              className="h-2.5 rounded-full transition-all"
                              style={{ width: `${company.healthScore}%`, backgroundColor: currentHealthColor }}
                            />
                          </div>
                          <p
                            className={`text-xs font-semibold ${
                              company.healthScore > 70
                                ? TERMINAL_SUCCESS_TEXT
                                : company.healthScore < 40
                                  ? TERMINAL_DANGER_TEXT
                                  : "text-amber-300"
                            }`}
                          >
                            {company.healthScore}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-terminal-textSecondary">{company.exDate}</td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {formatFrequencyLabel(company.frequency, t)}
                      </td>
                      <td className="px-4 py-3 text-terminal-textSecondary">
                        {formatDividendPerShareAmount(company.dividendPerShare, company.symbol, {
                          currency: company.currency,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <DividendDataStatusBadge status={company.dataStatus} />
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
