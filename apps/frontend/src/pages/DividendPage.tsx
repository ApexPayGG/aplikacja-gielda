import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExportButton } from "../components/ExportButton";
import { useAuth } from "../context/AuthContext";
import { getDividendGrowthScreener, type DividendGrowthRow } from "../services/api";
import { BrandLogo } from "../components/BrandLogo";
import {
  GLASS_INPUT,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
  GLASS_TEXT_NEGATIVE,
  GLASS_TEXT_POSITIVE,
} from "../components/behavioral-coach/glassStyles";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

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

function formatDividendPerShare(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
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
  return {
    symbol: row.symbol,
    name: typeof extended.name === "string" ? extended.name : typeof extended.companyName === "string" ? extended.companyName : row.symbol,
    logoUrl: typeof extended.logoUrl === "string" ? extended.logoUrl : null,
    sector: typeof extended.sector === "string" && extended.sector.trim() ? extended.sector : "Unknown",
    yieldPct,
    healthScore,
    exDate,
    dividendPerShare,
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
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className={GLASS_PAGE_TITLE}>{t("dividend.pageTitle", { defaultValue: "Dividends" })}</h1>
            <p className={`text-sm md:text-base ${GLASS_PAGE_SUBTITLE}`}>
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

        <section className={GLASS_SECTION}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("dividend.searchLabel", { defaultValue: "Search" })}
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dividend.searchPlaceholder", { defaultValue: "Symbol or company name" })}
                className={`${GLASS_INPUT} mt-1`}
              />
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("dividend.yieldMin", { defaultValue: "Min yield %" })}
              </span>
              <input
                type="number"
                value={yieldMin}
                onChange={(event) => setYieldMin(event.target.value)}
                min={0}
                step={0.1}
                className={`${GLASS_INPUT} mt-1`}
              />
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("dividend.yieldMax", { defaultValue: "Max yield %" })}
              </span>
              <input
                type="number"
                value={yieldMax}
                onChange={(event) => setYieldMax(event.target.value)}
                min={0}
                step={0.1}
                className={`${GLASS_INPUT} mt-1`}
              />
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("dividend.sector", { defaultValue: "Sector" })}
              </span>
              <select value={sector} onChange={(event) => setSector(event.target.value)} className={`${GLASS_INPUT} mt-1`}>
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

        <section className={GLASS_SECTION}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-[#94a3b8]">
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-[#94a3b8] hover:text-white" onClick={() => onSort("symbol")}>
                      {t("dividend.columnSymbol", { defaultValue: "Symbol" })}
                      {sortIndicator("symbol")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-[#94a3b8] hover:text-white" onClick={() => onSort("name")}>
                      {t("dividend.columnName", { defaultValue: "Name" })}
                      {sortIndicator("name")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-[#94a3b8] hover:text-white" onClick={() => onSort("yieldPct")}>
                      {t("dividend.columnYield", { defaultValue: "Yield %" })}
                      {sortIndicator("yieldPct")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-[#94a3b8] hover:text-white" onClick={() => onSort("healthScore")}>
                      {t("dividend.columnHealth", { defaultValue: "Health Score" })}
                      {sortIndicator("healthScore")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold text-[#94a3b8] hover:text-white" onClick={() => onSort("exDate")}>
                      {t("dividend.columnExDate", { defaultValue: "Ex-Date" })}
                      {sortIndicator("exDate")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-[#94a3b8] hover:text-white"
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
                    <td className="px-4 py-6 text-sm text-[#94a3b8]" colSpan={6}>
                      {t("common.loading", { defaultValue: "Loading..." })}
                    </td>
                  </tr>
                ) : null}
                {error ? (
                  <tr>
                    <td className={`px-4 py-6 text-sm ${GLASS_TEXT_NEGATIVE}`} colSpan={6}>
                      {error}
                    </td>
                  </tr>
                ) : null}
                {!loading && !error && filteredAndSorted.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-[#94a3b8]" colSpan={6}>
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
                          className={`border-t border-white/10 transition-colors ${
                            isHovered ? "bg-white/[0.06]" : "bg-transparent"
                          }`}
                          onMouseEnter={() => setHoveredSymbol(company.symbol)}
                          onMouseLeave={() => setHoveredSymbol(null)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg p-0.5">
                                <BrandLogo size="mini" className="h-full max-h-7 w-full object-contain" />
                              </div>
                              <span className="font-semibold text-white">{company.symbol}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-white">{company.name}</p>
                              <p className="text-xs text-[#94a3b8]">{company.sector}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/15 px-2.5 py-1 text-xs font-semibold text-[#22d3ee]">
                              {formatPercent(company.yieldPct)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <div className="h-2.5 w-full rounded-full bg-white/10">
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
                                    ? GLASS_TEXT_POSITIVE
                                    : company.healthScore < 40
                                      ? GLASS_TEXT_NEGATIVE
                                      : "text-amber-300"
                                }`}
                              >
                                {company.healthScore}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-white/80">{company.exDate}</td>
                          <td className="px-4 py-3 text-white/90">{formatDividendPerShare(company.dividendPerShare)}</td>
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
