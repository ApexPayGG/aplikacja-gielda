import type { DividendDataStatus, DividendGrowthRow } from "../../services/api";
import { inferCurrencyFromSymbol } from "../../utils/dividendFormat";

export type DividendHubView = "radar" | "screener" | "intelligence" | "compound";

export const DIVIDEND_HUB_VIEWS: DividendHubView[] = ["radar", "screener", "intelligence", "compound"];

export function parseDividendHubView(value: string | null): DividendHubView {
  if (value === "screener" || value === "intelligence" || value === "compound") return value;
  return "radar";
}

export interface DividendCompanyRow {
  symbol: string;
  name: string;
  logoUrl: string | null;
  sector: string;
  yieldPct: number;
  healthScore: number;
  exDate: string;
  payDate: string;
  dividendPerShare: number | null;
  currency: string;
  frequency: string | null;
  dataStatus: DividendDataStatus;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseDateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveHealthScore(row: DividendGrowthRow, yieldPct: number): number {
  const rowRecord = row as unknown as Record<string, unknown>;
  const growthYoY = toNumber(rowRecord.growthYoY) ?? 0;
  const cagr5Y = toNumber(rowRecord.cagr5Y) ?? 0;
  const cagr10Y = toNumber(rowRecord.cagr10Y) ?? 0;
  const score = 52 + growthYoY * 0.7 + cagr5Y * 1.1 + cagr10Y * 0.6 + (yieldPct - 3) * 4;
  return Math.round(clamp(score, 0, 100));
}

export function mapCompanyRow(row: DividendGrowthRow): DividendCompanyRow {
  const extended = row as DividendGrowthRow & Record<string, unknown>;
  const yieldPct = toNumber(extended.latestYield ?? extended.dividendYield) ?? 0;
  const providedHealth = toNumber(extended.healthScore ?? extended.safetyScore);
  const healthScore =
    providedHealth == null ? deriveHealthScore(row, yieldPct) : Math.round(clamp(providedHealth, 0, 100));
  const exDate =
    typeof extended.exDate === "string"
      ? extended.exDate
      : typeof extended.latestExDate === "string"
        ? extended.latestExDate
        : "-";
  const payDate = typeof extended.payDate === "string" ? extended.payDate : "-";
  const dividendPerShare = toNumber(
    extended.dividendPerShare ?? extended.latestDividendPerShare ?? extended.amount ?? extended.amountPerShare ?? null,
  );
  const frequency = typeof extended.frequency === "string" ? extended.frequency : null;
  const dataStatus =
    extended.dataStatus === "confirmed" ||
    extended.dataStatus === "estimated" ||
    extended.dataStatus === "stale" ||
    extended.dataStatus === "missing"
      ? extended.dataStatus
      : "missing";
  const exchange = typeof extended.exchange === "string" ? extended.exchange : null;
  const currency = inferCurrencyFromSymbol(row.symbol, {
    exchange,
    currency:
      typeof extended.currency === "string"
        ? extended.currency
        : typeof extended.dividendCurrency === "string"
          ? extended.dividendCurrency
          : null,
  });
  return {
    symbol: row.symbol,
    name:
      typeof extended.name === "string"
        ? extended.name
        : typeof extended.companyName === "string"
          ? extended.companyName
          : row.symbol,
    logoUrl: typeof extended.logoUrl === "string" ? extended.logoUrl : null,
    sector: typeof extended.sector === "string" && extended.sector.trim() ? extended.sector : "Unknown",
    yieldPct,
    healthScore,
    exDate,
    payDate,
    dividendPerShare,
    currency,
    frequency,
    dataStatus,
  };
}

export function calendarEventToRow(event: {
  symbol: string;
  exDate: string;
  payDate: string | null;
  amount: number | null;
  currency: string;
  yield: number | null;
  frequency: string | null;
  dataStatus: DividendDataStatus;
}): DividendCompanyRow {
  return {
    symbol: event.symbol,
    name: event.symbol,
    logoUrl: null,
    sector: "—",
    yieldPct: event.yield ?? 0,
    healthScore: 0,
    exDate: event.exDate,
    payDate: event.payDate ?? "-",
    dividendPerShare: event.amount,
    currency: event.currency,
    frequency: event.frequency,
    dataStatus: event.dataStatus,
  };
}

export function formatExDateLabel(isoOrDash: string): string {
  if (!isoOrDash || isoOrDash === "-") return "—";
  const parsed = Date.parse(isoOrDash);
  if (!Number.isFinite(parsed)) return isoOrDash;
  return new Date(parsed).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
