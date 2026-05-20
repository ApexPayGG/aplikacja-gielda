import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExportButton } from "../components/ExportButton";
import { useAuth } from "../context/AuthContext";
import { getDividendGrowthScreener, type DividendGrowthRow } from "../services/api";
import { BrandLogo } from "../components/BrandLogo";
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

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">{t("dividend.pageTitle", { defaultValue: "Dywidendy" })}</h1>
            <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
              {t("dividend.pageSubtitle", {
                defaultValue: "Screener spolek dywidendowych zgodny z design systemem AMC Energy.",
              })}
            </p>
          </div>
          <ExportButton endpoint="/export/dividend" userId={user?.id} label="Eksportuj dywidendy" />
        </header>

        <section className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                {t("dividend.searchLabel", { defaultValue: "Search" })}
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dividend.searchPlaceholder", { defaultValue: "Symbol lub nazwa spółki" })}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              />
            </label>

            <label className="text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                {t("dividend.yieldMin", { defaultValue: "Yield min %" })}
              </span>
              <input
                type="number"
                value={yieldMin}
                onChange={(event) => setYieldMin(event.target.value)}
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              />
            </label>

            <label className="text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                {t("dividend.yieldMax", { defaultValue: "Yield max %" })}
              </span>
              <input
                type="number"
                value={yieldMax}
                onChange={(event) => setYieldMax(event.target.value)}
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              />
            </label>

            <label className="text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                {t("dividend.sector", { defaultValue: "Sektor" })}
              </span>
              <select
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              >
                <option value="all">{t("dividend.sectorAll", { defaultValue: "Wszystkie" })}</option>
                {sectors.map((sectorName) => (
                  <option key={sectorName} value={sectorName}>
                    {sectorName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border shadow-sm" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}>
                <tr>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("symbol")}>
                      {t("dividend.columnSymbol", { defaultValue: "Logo+Symbol" })}
                      {sortIndicator("symbol")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("name")}>
                      {t("dividend.columnName", { defaultValue: "Nazwa" })}
                      {sortIndicator("name")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("yieldPct")}>
                      {t("dividend.columnYield", { defaultValue: "Yield %" })}
                      {sortIndicator("yieldPct")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("healthScore")}>
                      {t("dividend.columnHealth", { defaultValue: "Health Score" })}
                      {sortIndicator("healthScore")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("exDate")}>
                      {t("dividend.columnExDate", { defaultValue: "Ex-Date" })}
                      {sortIndicator("exDate")}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" className="font-semibold" onClick={() => onSort("dividendPerShare")}>
                      {t("dividend.columnDividendPerShare", { defaultValue: "Dywidenda/akcję" })}
                      {sortIndicator("dividendPerShare")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm" colSpan={6} style={{ color: colors.textSecondary }}>
                      {t("common.loading", { defaultValue: "Loading..." })}
                    </td>
                  </tr>
                ) : null}
                {error ? (
                  <tr>
                    <td className="px-4 py-6 text-sm" colSpan={6} style={{ color: colors.negative }}>
                      {error}
                    </td>
                  </tr>
                ) : null}
                {!loading && !error && filteredAndSorted.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm" colSpan={6} style={{ color: colors.textSecondary }}>
                      {t("dividend.noData", { defaultValue: "Brak wyników dla wybranych filtrów." })}
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
                          className="transition-colors"
                          onMouseEnter={() => setHoveredSymbol(company.symbol)}
                          onMouseLeave={() => setHoveredSymbol(null)}
                          style={{
                            borderTop: `1px solid ${colors.border}`,
                            backgroundColor: isHovered ? colors.bgSecondary : colors.bgPrimary,
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg p-0.5">
                                <BrandLogo size="mini" className="h-full max-h-7 w-full object-contain" />
                              </div>
                              <span className="font-semibold">{company.symbol}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold">{company.name}</p>
                              <p className="text-xs" style={{ color: colors.textMuted }}>{company.sector}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{
                                color: colors.brandDark,
                                backgroundColor: withAlpha(colors.brandCyan, 0.2),
                                border: `1px solid ${withAlpha(colors.brandCyan, 0.5)}`,
                              }}
                            >
                              {formatPercent(company.yieldPct)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <div className="h-2.5 w-full rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
                                <div
                                  className="h-2.5 rounded-full transition-all"
                                  style={{
                                    width: `${company.healthScore}%`,
                                    backgroundColor: currentHealthColor,
                                  }}
                                />
                              </div>
                              <p className="text-xs font-semibold" style={{ color: currentHealthColor }}>
                                {company.healthScore}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{company.exDate}</td>
                          <td className="px-4 py-3">{formatDividendPerShare(company.dividendPerShare)}</td>
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
