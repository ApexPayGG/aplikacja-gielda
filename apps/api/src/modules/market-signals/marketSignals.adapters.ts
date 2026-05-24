import type { MarketSignalIngestInput } from "./marketSignals.types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatUsdShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(abs / 1_000).toFixed(1)}K`;
  }
  return `$${abs.toFixed(0)}`;
}

export function normalizeProviderTicker(value: unknown): string | null {
  const raw = toStringValue(value);
  if (!raw) return null;
  const beforeDot = raw.split(".")[0]?.trim().toUpperCase() ?? "";
  const normalized = beforeDot.replace(/[^A-Z0-9.-]/g, "").slice(0, 20);
  return normalized.length > 0 ? normalized : null;
}

function readArray(payload: unknown, key: string): unknown[] {
  if (!isRecord(payload)) return [];
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function parseIsoEventTime(value: unknown): string | undefined {
  const raw = toStringValue(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function scorePolygonOptionsFlow(item: Record<string, unknown>): number {
  let score = 50;
  const premium = toNumber(item.premium) ?? 0;
  const volume = toNumber(item.volume) ?? 0;
  const openInterest = toNumber(item.open_interest) ?? 0;

  if (premium >= 1_000_000) score += 15;
  if (openInterest > 0 && volume / openInterest >= 3) score += 15;

  const contractType = toStringValue(item.contract_type)?.toLowerCase();
  if (contractType === "call" || contractType === "put") score += 10;

  return clampConfidence(score);
}

function buildOptionsFlowTitle(ticker: string, item: Record<string, unknown>): string {
  const contractType = toStringValue(item.contract_type)?.toLowerCase() ?? "options";
  const premium = toNumber(item.premium) ?? 0;
  return `${ticker} unusual ${contractType} options flow: ${formatUsdShort(premium)} premium`;
}

export function parsePolygonOptionsFlowPayload(
  payload: unknown,
  source = "polygon-options-flow",
): MarketSignalIngestInput[] {
  const results = readArray(payload, "results");
  const signals: MarketSignalIngestInput[] = [];

  for (const entry of results) {
    if (!isRecord(entry)) continue;

    const ticker =
      normalizeProviderTicker(entry.underlying_ticker) ?? normalizeProviderTicker(entry.ticker);
    if (!ticker) continue;

    signals.push({
      ticker,
      signalType: "OPTIONS_FLOW",
      source,
      confidenceScore: scorePolygonOptionsFlow(entry),
      title: buildOptionsFlowTitle(ticker, entry),
      rawPayload: entry,
      eventTime: parseIsoEventTime(entry.trade_timestamp),
    });
  }

  return signals;
}

function scorePolygonDarkPool(item: Record<string, unknown>, notional: number): number {
  let score = 60;
  if (notional >= 50_000_000) score += 10;
  if (notional >= 100_000_000) score += 10;

  const exchange = toStringValue(item.exchange)?.toUpperCase() ?? "";
  if (exchange.includes("DARK") || exchange.includes("TRF")) score += 10;

  return clampConfidence(score);
}

export function parsePolygonDarkPoolPayload(
  payload: unknown,
  source = "polygon-dark-pool",
): MarketSignalIngestInput[] {
  const results = readArray(payload, "results");
  const signals: MarketSignalIngestInput[] = [];

  for (const entry of results) {
    if (!isRecord(entry)) continue;

    const ticker = normalizeProviderTicker(entry.ticker);
    if (!ticker) continue;

    const price = toNumber(entry.price);
    const size = toNumber(entry.size);
    if (price == null || size == null) continue;

    const notional = price * size;
    if (notional < 50_000_000) continue;

    signals.push({
      ticker,
      signalType: "DARK_POOL",
      source,
      confidenceScore: scorePolygonDarkPool(entry, notional),
      title: `${ticker} dark pool block print: ${formatUsdShort(notional)} notional`,
      rawPayload: entry,
      eventTime: parseIsoEventTime(entry.sip_timestamp),
    });
  }

  return signals;
}

function scoreSecFiling(form: string | null): number {
  const normalized = form?.toUpperCase() ?? "";
  if (normalized === "10-K") return 70;
  if (normalized === "10-Q") return 65;
  if (normalized === "8-K") return 55;
  return 50;
}

export function parseSecFilingPayload(
  payload: unknown,
  source = "sec-filing",
): MarketSignalIngestInput[] {
  const filings = readArray(payload, "filings");
  const signals: MarketSignalIngestInput[] = [];

  for (const entry of filings) {
    if (!isRecord(entry)) continue;

    const ticker = normalizeProviderTicker(entry.ticker);
    if (!ticker) continue;

    const form = toStringValue(entry.form);
    signals.push({
      ticker,
      signalType: "SEC_FILING",
      source,
      confidenceScore: scoreSecFiling(form),
      title: `${ticker} SEC filing: ${form ?? "unknown"}`,
      summary: toStringValue(entry.description) ?? undefined,
      rawPayload: entry,
      eventTime: parseIsoEventTime(entry.filedAt),
    });
  }

  return signals;
}

function isInsiderPurchaseCode(code: string | null): boolean {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  return normalized === "P" || normalized === "PURCHASE";
}

export type EodhdTransactionDirection = "purchase" | "sale" | "transaction";

function toPositiveNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

export function getEodhdTransactionDirection(item: Record<string, unknown>): EodhdTransactionDirection {
  const transactionCode = toStringValue(item.transactionCode)?.toUpperCase() ?? "";
  if (transactionCode === "P" || isInsiderPurchaseCode(transactionCode)) return "purchase";
  if (transactionCode === "S" || transactionCode === "SALE") return "sale";

  const acquiredDisposed = toStringValue(item.transactionAcquiredDisposed)?.toUpperCase() ?? "";
  if (acquiredDisposed === "A") return "purchase";
  if (acquiredDisposed === "D") return "sale";

  return "transaction";
}

export function getEodhdTransactionValue(item: Record<string, unknown>): number | null {
  const transactionAmount = toPositiveNumber(item.transactionAmount);
  if (transactionAmount != null) return transactionAmount;

  const securitiesTransacted = toPositiveNumber(item.securitiesTransacted);
  const transactionPrice = toPositiveNumber(item.transactionPrice);
  if (securitiesTransacted != null && transactionPrice != null) {
    return securitiesTransacted * transactionPrice;
  }

  const transactionShares = toPositiveNumber(item.transactionShares);
  if (transactionShares != null && transactionPrice != null) {
    return transactionShares * transactionPrice;
  }

  return null;
}

function scoreEodhdInsiderActivity(
  direction: EodhdTransactionDirection,
  transactionValue: number | null,
): number {
  let score = 55;
  if (direction === "sale") score = 60;
  if (direction === "purchase") score = 65;

  if (transactionValue != null) {
    if (transactionValue >= 1_000_000) score += 10;
    if (transactionValue >= 10_000_000) score += 5;
  }

  return clampConfidence(score);
}

function buildEodhdInsiderTitle(
  ticker: string,
  direction: EodhdTransactionDirection,
  ownerName: string,
  transactionValue: number | null,
): string {
  if (transactionValue != null) {
    return `${ticker} insider ${direction}: ${formatUsdShort(transactionValue)} by ${ownerName}`;
  }
  return `${ticker} insider ${direction} disclosed by ${ownerName}`;
}

function buildEodhdInsiderSummary(
  direction: EodhdTransactionDirection,
  ownerName: string,
  transactionValue: number | null,
): string {
  if (transactionValue != null) {
    return `Reported insider ${direction} by ${ownerName}. Estimated transaction value: ${formatUsdShort(transactionValue)}.`;
  }
  return `Reported insider ${direction} by ${ownerName}. Transaction value was not disclosed in provider payload.`;
}

export function parseEodhdInsiderActivityPayload(
  payload: unknown,
  source = "eodhd-insider-activity",
): MarketSignalIngestInput[] {
  const rows = readArray(payload, "data");
  const signals: MarketSignalIngestInput[] = [];

  for (const entry of rows) {
    if (!isRecord(entry)) continue;

    const ticker = normalizeProviderTicker(entry.code);
    if (!ticker) continue;

    const direction = getEodhdTransactionDirection(entry);
    const transactionValue = getEodhdTransactionValue(entry);
    const ownerName = toStringValue(entry.ownerName) ?? "Unknown insider";

    signals.push({
      ticker,
      signalType: "INSIDER_ACTIVITY",
      source,
      confidenceScore: scoreEodhdInsiderActivity(direction, transactionValue),
      title: buildEodhdInsiderTitle(ticker, direction, ownerName, transactionValue),
      summary: buildEodhdInsiderSummary(direction, ownerName, transactionValue),
      rawPayload: entry,
      eventTime: parseIsoEventTime(entry.transactionDate),
    });
  }

  return signals;
}
