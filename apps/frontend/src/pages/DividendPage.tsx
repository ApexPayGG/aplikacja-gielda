import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExportButton } from "../components/ExportButton";
import { useAuth } from "../context/AuthContext";
import { getDividendGrowthScreener, type DividendGrowthRow } from "../services/api";
import { CompanyLogo } from "../components/CompanyLogo";
import {
  TERMINAL_DANGER_TEXT,
  TERMINAL_DIVIDEND_BADGE,
  TERMINAL_DIVIDEND_PAGE,
  TERMINAL_DIVIDEND_PAGE_INNER,
  TERMINAL_DIVIDEND_PANEL,
  TERMINAL_DIVIDEND_ROW,
  TERMINAL_DIVIDEND_TABLE,
  TERMINAL_DIVIDEND_TABLE_HEAD,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SUCCESS_TEXT,
} from "../components/terminal/terminalStyles";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatDividendPerShareAmount, inferCurrencyFromSymbol } from "../utils/dividendFormat";

type SortKey = "symbol" | "name" | "yieldPct" | "healthScore" | "exDate" | "dividendPerShare";
type SortDirection = "asc" | "desc";

interface DividendCompanyRow {
  symbol: string;
  name: string;
  logoUrl: string | null;
  sector: string;
  yieldPct: number;
  healthScore: number;
  exDate: string;
  dividendPerShare: number | null;
  currency: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}


function parseDateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function healthColor(score: number): string {
  if (score > 70) return colors.positive;
  if (score >= 40) return colors.brandGold;
  return colors.negative;
}

function deriveHealthScore(row: DividendGrowthRow, yieldPct: number): number {
  const rowRecord = row as unknown as Record<string, unknown>;
  const growthYoY = toNumber(rowRecord.growthYoY) ?? 0;
  const cagr5Y = toNumber(rowRecord.cagr5Y) ?? 0;
  const cagr10Y = toNumber(rowRecord.cagr10Y) ?? 0;
  const score = 52 + growthYoY * 0.7 + cagr5Y * 1.1 + cagr10Y * 0.6 + (yieldPct - 3) * 4;
  return Math.round(clamp(score, 0, 100));
}

function mapCompanyRow(row: DividendGrowthRow): DividendCompanyRow {
  const extended = row as DividendGrowthRow & Record<string, unknown>;
  const yieldPct = toNumber(extended.latestYield ?? extended.dividendYield) ?? 0;
  const providedHealth = toNumber(extended.healthScore ?? extended.safetyScore);
  const healthScore = providedHealth == null ? deriveHealthScore(row, yieldPct) : Math.round(clamp(providedHealth, 0, 100));
  const exDate = typeof extended.exDate === "string"
    ? extended.exDate
    : typeof extended.latestExDate === "string"
      ? extended.latestExDate
      : "-";
  const dividendPerShare = toNumber(
    extended.dividendPerShare ?? extended.latestDividendPerShare ?? extended.amountPerShare ?? null,
  );
  const exchange = typeof extended.exchange === "string" ? extended.exchange : null;
  const currency = inferCurrencyFromSymbol(row.symbol, {
    exchange,
    currency: typeof extended.currency === "string" ? extended.currency : typeof extended.dividendCurrency === "string" ? extended.dividendCurrency : null,
  });
  return {
    symbol: row.symbol,
    name: typeof extended.name === "string" ? extended.name : typeof extended.companyName === "string" ? extended.companyName : row.symbol,
    logoUrl: typeof extended.logoUrl === "string" ? extended.logoUrl : null,
    sector: typeof extended.sector === "string" && extended.sector.trim() ? extended.sector : "Unknown",
    yieldPct,
    healthScore,
    exDate,
    dividendPerShare,
    currency,
  };
}

export function DividendPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<DividendGrowthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yieldMin, setYieldMin] = useState("");
  const [yieldMax, setYieldMax] = useState("");
  const [sector, setSector] = useState("all");
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("yieldPct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadCompanies = useCallback(async () => {
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
      const matchesQuery = normalizedQuery === ""
        || company.symbol.toLowerCase().includes(normalizedQuery)
        || company.name.toLowerCase().includes(normalizedQuery);
      const matchesSector = sector === "all" || company.sector === sector;
      const matchesMin = min == null || Number.isNaN(min) ? true : company.yieldPct >= min;
      const matchesMax = max == null || Number.isNaN(max) ? true : company.yieldPct <= max;
      return matchesQuery && matchesSector && matchesMin && matchesMax;
    });

    const sorted = [...filtered].sort((left, right) => {
      const directionFactor = sortDirection === "asc" ? 1 : -1;
      const leftValue =
        sortKey === "exDate"
          ? parseDateValue(left.exDate)
          : sortKey === "symbol" || sortKey === "name"
            ? left[sortKey].toLowerCase()
            : left[sortKey] ?? 0;
      const rightValue =
        sortKey === "exDate"
          ? parseDateValue(right.exDate)
          : sortKey === "symbol" || sortKey === "name"
            ? right[sortKey].toLowerCase()
            : right[sortKey] ?? 0;

      if (leftValue < rightValue) return -1 * directionFactor;
      if (leftValue > rightValue) return 1 * directionFactor;
      return 0;
    });

    return sorted;
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
    <div className={TERMINAL_DIVIDEND_PAGE}>
      <div className={TERMINAL_DIVIDEND_PAGE_INNER}>
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className={TERMINAL_PAGE_TITLE}>{t("dividend.pageTitle", { defaultValue: "Dividends" })}</h1>
            <p className={TERMINAL_PAGE_SUBTITLE}>
              {t("dividend.pageSubtitle", {
                defaultValue: "Screen dividend-paying companies with yield, safety score and ex-dates.",
              })}
            </p>
          </div>
          <ExportButton
            endpoint="/export/dividend"
            userId={user?.id}
            label={t("dividend.exportLabel", { defaultValue: "Export dividends" })}
          />
        </header>

        <section className={TERMINAL_DIVIDEND_PANEL}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>
                {t("dividend.searchLabel", { defaultValue: "Search" })}
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dividend.searchPlaceholder", { defaultValue: "Symbol or company name" })}
                className={`${TERMINAL_INPUT} mt-1`}
              />
            </label>

            <label className="text-sm">
              <span className={TERMINAL_FORM_LABEL}>
                {t("dividend.yieldMin", { defaultValue: "Min yield %" })}
              </span>
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
              <span className={TERMINAL_FORM_LABEL}>
                {t("dividend.yieldMax", { defaultValue: "Max yield %" })}
              </span>
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
              <span className={TERMINAL_FORM_LABEL}>
                {t("dividend.sector", { defaultValue: "Sector" })}
              </span>
              <select value={sector} onChange={(event) => setSector(event.target.value)} className={`${TERMINAL_INPUT} mt-1`}>
                <option value="all">{t("dividend.sectorAll", { defaultValue: "All" })}</option>
                {sectors.map((sectorName) => (
                  <option key={sectorName} value={sectorName}>
                    {sectorName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={TERMINAL_DIVIDEND_TABLE}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className={TERMINAL_DIVIDEND_TABLE_HEAD}>
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-terminal-textMuted transition hover:text-terminal-text" onClick={() => onSort("symbol")}>
                      {t("dividend.columnSymbol", { defaultValue: "Ticker" })}
                      {sortIndicator("symbol")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-terminal-textMuted transition hover:text-terminal-text" onClick={() => onSort("name")}>
                      {t("dividend.columnName", { defaultValue: "Name" })}
                      {sortIndicator("name")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-terminal-textMuted transition hover:text-terminal-text" onClick={() => onSort("yieldPct")}>
                      {t("dividend.columnYield", { defaultValue: "Yield %" })}
                      {sortIndicator("yieldPct")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-terminal-textMuted transition hover:text-terminal-text" onClick={() => onSort("healthScore")}>
                      {t("dividend.columnHealth", { defaultValue: "Health Score" })}
                      {sortIndicator("healthScore")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-terminal-textMuted transition hover:text-terminal-text" onClick={() => onSort("exDate")}>
                      {t("dividend.columnExDate", { defaultValue: "Ex-Date" })}
                      {sortIndicator("exDate")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-terminal-textMuted transition hover:text-terminal-text"
                      onClick={() => onSort("dividendPerShare")}
                    >
                      {t("dividend.columnDividendPerShare", { defaultValue: "Dividend / share" })}
                      {sortIndicator("dividendPerShare")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-terminal-textMuted" colSpan={6}>
                      {t("common.loading", { defaultValue: "Loading..." })}
                    </td>
                  </tr>
                ) : null}
                {error ? (
                  <tr>
                    <td className={`px-4 py-6 text-sm ${TERMINAL_DANGER_TEXT}`} colSpan={6}>
                      {error}
                    </td>
                  </tr>
                ) : null}
                {!loading && !error && filteredAndSorted.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-terminal-textMuted" colSpan={6}>
                      {t("dividend.noResults", { defaultValue: "No results for the selected filters." })}
                    </td>
                  </tr>
                ) : null}
                {!loading && !error
                  ? filteredAndSorted.map((company) => {
                      const currentHealthColor = healthColor(company.healthScore);
                      const isHovered = hoveredSymbol === company.symbol;
                      return (
                        <tr
                          key={company.symbol}
                          className={`${TERMINAL_DIVIDEND_ROW} ${
                            isHovered ? "bg-terminal-panelSecondary/70" : ""
                          }`}
                          onMouseEnter={() => setHoveredSymbol(company.symbol)}
                          onMouseLeave={() => setHoveredSymbol(null)}
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
                            <span className={TERMINAL_DIVIDEND_BADGE}>
                              {formatPercent(company.yieldPct)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <div className="h-2.5 w-full rounded-full bg-terminal-panelSecondary">
                                <div
                                  className="h-2.5 rounded-full transition-all"
                                  style={{
                                    width: `${company.healthScore}%`,
                                    backgroundColor: currentHealthColor,
                                  }}
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
                            {formatDividendPerShareAmount(company.dividendPerShare, company.symbol, {
                              currency: company.currency,
                            })}
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
