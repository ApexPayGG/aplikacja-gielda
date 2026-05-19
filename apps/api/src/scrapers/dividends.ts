/**
 * Hybrid dividend data: EODHD (primary) + Finnhub (fallback).
 * EODHD: https://eodhd.com/financial-apis/api-splits-dividends/
 * Finnhub: https://finnhub.io/docs/api/stock-dividends
 */
import process from "node:process";

const EODHD_DIV_BASE = "https://eodhd.com/api/div";
const FINNHUB_DIV_BASE = "https://finnhub.io/api/v1/stock/dividend";
const LOG_SCOPE = "dividend_scraper";

export type DividendLogLevel = "info" | "warn" | "error";

export function dividendLog(level: DividendLogLevel, message: string, extra?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    scope: LOG_SCOPE,
    level,
    message,
    ...extra,
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

/** Raw row from EODHD /div JSON */
export interface EodhdDividendRow {
  date: string;
  declarationDate?: string;
  recordDate?: string;
  paymentDate?: string;
  period?: string;
  value: number;
  unadjustedValue?: number;
  currency?: string;
}

/** Common format for DB + services */
export interface NormalizedDividendRow {
  exDate: Date;
  payDate: Date;
  amount: number;
  currency: string;
  frequency: string | null;
  source: "eodhd" | "finnhub";
}

export interface FetchDividendHistoryOptions {
  fullSymbol: string;
  from?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  /** Use `demo` token (EODHD allows for AAPL.US only) when no key */
  allowDemo?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeEodRow(raw: Record<string, unknown>): EodhdDividendRow | null {
  const date = raw.date ?? raw.exDate ?? raw["ex-dividend date"];
  if (typeof date !== "string" || !date.trim()) return null;
  const value =
    typeof raw.value === "number"
      ? raw.value
      : typeof raw.dividend === "number"
        ? raw.dividend
        : typeof raw.unadjustedValue === "number"
          ? raw.unadjustedValue
          : Number(raw.value ?? raw.dividend ?? raw.unadjustedValue ?? NaN);
  if (!Number.isFinite(value) || value <= 0) return null;

  return {
    date: String(date).trim(),
    declarationDate: typeof raw.declarationDate === "string" ? raw.declarationDate : undefined,
    recordDate: typeof raw.recordDate === "string" ? raw.recordDate : undefined,
    paymentDate: typeof raw.paymentDate === "string" ? raw.paymentDate : undefined,
    period: typeof raw.period === "string" ? raw.period : undefined,
    value,
    unadjustedValue: typeof raw.unadjustedValue === "number" ? raw.unadjustedValue : undefined,
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
  };
}

export function mapEodhdToNormalized(row: EodhdDividendRow): NormalizedDividendRow {
  const exDate = new Date(row.date + "T12:00:00.000Z");
  const payRaw = row.paymentDate?.trim();
  const payDate = payRaw ? new Date(payRaw + "T12:00:00.000Z") : exDate;
  const freq = row.period ? row.period.toLowerCase().replace(/\s+/g, "_") : null;
  return {
    exDate,
    payDate: Number.isNaN(payDate.getTime()) ? exDate : payDate,
    amount: row.value,
    currency: (row.currency ?? "USD").slice(0, 8),
    frequency: freq,
    source: "eodhd",
  };
}

function mapFinnhubToNormalized(raw: Record<string, unknown>): NormalizedDividendRow | null {
  const date = raw.date;
  if (typeof date !== "string" || !date.trim()) return null;
  const amt =
    typeof raw.amount === "number"
      ? raw.amount
      : typeof raw.adjustedAmount === "number"
        ? raw.adjustedAmount
        : Number(raw.amount ?? raw.adjustedAmount ?? NaN);
  if (!Number.isFinite(amt) || amt <= 0) return null;

  const exDate = new Date(String(date).trim() + "T12:00:00.000Z");
  const payRaw = typeof raw.payDate === "string" ? raw.payDate : typeof raw.paymentDate === "string" ? raw.paymentDate : "";
  const payDate = payRaw ? new Date(payRaw.trim() + "T12:00:00.000Z") : exDate;
  const cur = typeof raw.currency === "string" ? raw.currency : "USD";
  const freq =
    typeof raw.frequency === "number"
      ? String(raw.frequency)
      : typeof raw.frequency === "string"
        ? raw.frequency.toLowerCase().replace(/\s+/g, "_")
        : null;

  return {
    exDate,
    payDate: Number.isNaN(payDate.getTime()) ? exDate : payDate,
    amount: amt,
    currency: cur.slice(0, 8),
    frequency: freq,
    source: "finnhub",
  };
}

export function toEodhdDividendSymbol(symbol: string, exchangeSuffix = ".US"): string {
  const s = symbol.trim().toUpperCase();
  const suf = exchangeSuffix.startsWith(".") ? exchangeSuffix : `.${exchangeSuffix}`;
  if (s.includes(".")) return s;
  return `${s}${suf}`;
}

function yearsToFromIso(years: number): string {
  const y = Math.min(40, Math.max(1, years));
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCFullYear(d.getUTCFullYear() - y);
  return d.toISOString().slice(0, 10);
}

/** Optional fixed start year (e.g. 2020) from EODHD_DIVIDEND_FROM_YEAR */
export function dividendFromIsoOrYears(years: number): string {
  const raw = process.env.EODHD_DIVIDEND_FROM_YEAR?.trim();
  if (raw && /^\d{4}$/.test(raw)) {
    return `${raw}-01-01`;
  }
  return yearsToFromIso(years);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * True if EODHD likely returned only ~free-tier window (≈1y) while we asked for more history.
 */
export function isLikelyEodhdFreeTierTruncation(requestedFrom: Date, rows: EodhdDividendRow[]): boolean {
  if (rows.length === 0) return false;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const min = new Date(sorted[0].date + "T12:00:00.000Z");
  const max = new Date(sorted[sorted.length - 1].date + "T12:00:00.000Z");
  const dataSpanDays = (max.getTime() - min.getTime()) / 86_400_000;
  const requestedSpanDays = (Date.now() - requestedFrom.getTime()) / 86_400_000;
  return requestedSpanDays > 400 && dataSpanDays < 400;
}

async function fetchEodhdOnce(fullSymbol: string, token: string, from?: string): Promise<Response> {
  const params = new URLSearchParams({ api_token: token, fmt: "json" });
  if (from) params.set("from", from);
  const url = `${EODHD_DIV_BASE}/${encodeURIComponent(fullSymbol)}?${params.toString()}`;
  return fetch(url, { method: "GET", headers: { Accept: "application/json" } });
}

function parseEodhdDividendResponse(text: string): EodhdDividendRow[] {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`EODHD expected array: ${text.slice(0, 200)}`);

  const rows: EodhdDividendRow[] = [];
  for (const item of parsed) {
    const n = normalizeEodRow(item as Record<string, unknown>);
    if (n) rows.push(n);
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

async function fetchEodhdDividendRows(
  sym: string,
  fullSymbol: string,
  token: string,
  from: string,
  maxRetries = 4,
): Promise<EodhdDividendRow[]> {
  const baseDelayMs = 500;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchEodhdOnce(fullSymbol, token, from);
      const text = await res.text();

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`EODHD HTTP ${res.status}: ${text.slice(0, 200)}`);
        const wait = baseDelayMs * 2 ** attempt;
        dividendLog("warn", "eodhd_retry", { fullSymbol, status: res.status, attempt, waitMs: wait });
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`EODHD HTTP ${res.status}: ${text.slice(0, 400)}`);

      const rows = parseEodhdDividendResponse(text);
      const reqFrom = new Date(from + "T12:00:00.000Z");
      if (isLikelyEodhdFreeTierTruncation(reqFrom, rows)) {
        dividendLog("warn", "eodhd_possible_free_tier_truncation", {
          symbol: sym,
          fullSymbol,
          rows: rows.length,
          requestedFrom: from,
        });
      }

      dividendLog("info", "eodhd_fetch_ok", { fullSymbol, count: rows.length, from });
      return rows;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === maxRetries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  dividendLog("error", "eodhd_fetch_failed", { symbol: sym, from, error: lastErr?.message });
  throw lastErr ?? new Error("fetchEodhdDividendRows failed");
}

/** EODHD dividends since a fixed ISO date (e.g. 2018-01-01). */
export async function fetchEodhdDividendsSince(symbol: string, fromIso: string): Promise<NormalizedDividendRow[]> {
  const sym = symbol.trim().toUpperCase();
  const from = fromIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error(`Invalid from date: ${fromIso}`);
  }
  const suffix = process.env.EODHD_DIVIDEND_EXCHANGE?.trim() || ".US";
  const fullSymbol = toEodhdDividendSymbol(sym, suffix);
  const key = process.env.EODHD_API_KEY?.trim();
  const token =
    key ||
    (process.env.DIVIDEND_EODHD_DEMO === "1" && fullSymbol === "AAPL.US" ? "demo" : "");
  if (!token) {
    throw new Error("EODHD_API_KEY is not set (or set DIVIDEND_EODHD_DEMO=1 for AAPL.US demo only)");
  }

  const rows = await fetchEodhdDividendRows(sym, fullSymbol, token, from);
  return rows.map(mapEodhdToNormalized);
}

/**
 * PRIMARY: EODHD dividend history for `symbol` (US suffix) over `years`.
 * Maps: date→exDate, paymentDate→payDate, value→amount, period→frequency.
 */
export async function fetchDividendHistory(symbol: string, years: number): Promise<EodhdDividendRow[]> {
  const sym = symbol.trim().toUpperCase();
  const suffix = process.env.EODHD_DIVIDEND_EXCHANGE?.trim() || ".US";
  const fullSymbol = toEodhdDividendSymbol(sym, suffix);
  const from = dividendFromIsoOrYears(years);
  const key = process.env.EODHD_API_KEY?.trim();
  const token =
    key ||
    (process.env.DIVIDEND_EODHD_DEMO === "1" && fullSymbol === "AAPL.US" ? "demo" : "");
  if (!token) {
    throw new Error("EODHD_API_KEY is not set (or set DIVIDEND_EODHD_DEMO=1 for AAPL.US demo only)");
  }

  return fetchEodhdDividendRows(sym, fullSymbol, token, from);
}

/**
 * FALLBACK: Finnhub stock dividends.
 * GET /api/v1/stock/dividend?symbol=&from=&to=
 */
export async function fetchDividendHistoryFinnhub(symbol: string, years: number): Promise<NormalizedDividendRow[]> {
  const token = process.env.FINNHUB_API_KEY?.trim();
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not set");
  }
  const sym = symbol.trim().toUpperCase();
  const lookback = Math.min(40, Math.max(1, years));
  const from = dividendFromIsoOrYears(lookback);
  const to = toIsoDate(new Date());
  const url = `${FINNHUB_DIV_BASE}?${new URLSearchParams({ symbol: sym, from, to, token }).toString()}`;

  const maxRetries = 3;
  const baseDelayMs = 600;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`Finnhub HTTP ${res.status}`);
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}: ${text.slice(0, 400)}`);

      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) throw new Error(`Finnhub expected array: ${text.slice(0, 200)}`);

      const out: NormalizedDividendRow[] = [];
      for (const item of parsed) {
        const n = mapFinnhubToNormalized(item as Record<string, unknown>);
        if (n) out.push(n);
      }
      out.sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
      dividendLog("info", "finnhub_fetch_ok", { symbol: sym, count: out.length });
      return out;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === maxRetries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  dividendLog("error", "finnhub_fetch_failed", { symbol: sym, error: lastErr?.message });
  throw lastErr ?? new Error("fetchDividendHistoryFinnhub failed");
}

/** Merge: EODHD rows win on same ex-day; Finnhub fills gaps. */
export function mergeDividendRows(
  primary: NormalizedDividendRow[],
  secondary: NormalizedDividendRow[],
): NormalizedDividendRow[] {
  const map = new Map<string, NormalizedDividendRow>();
  for (const r of secondary) {
    map.set(toIsoDate(r.exDate), r);
  }
  for (const r of primary) {
    map.set(toIsoDate(r.exDate), r);
  }
  return [...map.values()].sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
}

/**
 * Hybrid: EODHD first; on failure or strong free-tier truncation signal, Finnhub (if key present).
 */
export async function fetchDividendHistoryHybrid(
  symbol: string,
  years: number,
): Promise<{ rows: NormalizedDividendRow[]; usedFinnhubFallback: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  let usedFinnhubFallback = false;
  const fromIso = yearsToFromIso(years);
  const reqFrom = new Date(fromIso + "T12:00:00.000Z");

  try {
    const eodRows = await fetchDividendHistory(symbol, years);
    let normalized = eodRows.map(mapEodhdToNormalized);

    const truncated = isLikelyEodhdFreeTierTruncation(reqFrom, eodRows);
    if (truncated) {
      warnings.push("eodhd_truncation_suspected_free_tier");
      if (process.env.FINNHUB_API_KEY?.trim()) {
        try {
          const fh = await fetchDividendHistoryFinnhub(symbol, years);
          normalized = mergeDividendRows(normalized, fh);
          usedFinnhubFallback = true;
          warnings.push("finnhub_merged_after_eodhd_truncation");
        } catch (e) {
          warnings.push(`finnhub_merge_failed:${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        warnings.push("finnhub_skipped_no_api_key");
      }
    }

    return { rows: normalized, usedFinnhubFallback, warnings };
  } catch (eodErr) {
    dividendLog("warn", "eodhd_failed_try_finnhub", {
      symbol,
      error: eodErr instanceof Error ? eodErr.message : String(eodErr),
    });
    if (!process.env.FINNHUB_API_KEY?.trim()) {
      throw eodErr instanceof Error ? eodErr : new Error(String(eodErr));
    }
    const fh = await fetchDividendHistoryFinnhub(symbol, years);
    warnings.push("finnhub_only_after_eodhd_error");
    return { rows: fh, usedFinnhubFallback: true, warnings };
  }
}

/** Low-level EOD fetch (options) — for tests / custom ticker. */
export async function fetchDividendHistoryRaw(options: FetchDividendHistoryOptions): Promise<EodhdDividendRow[]> {
  const token =
    process.env.EODHD_API_KEY?.trim() ||
    (options.allowDemo && options.fullSymbol === "AAPL.US" ? "demo" : "");
  if (!token) throw new Error("EODHD_API_KEY is not set");

  const res = await fetchEodhdOnce(options.fullSymbol, token, options.from);
  const text = await res.text();
  if (!res.ok) throw new Error(`EODHD HTTP ${res.status}: ${text.slice(0, 400)}`);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error("EODHD expected array");
  const rows: EodhdDividendRow[] = [];
  for (const item of parsed) {
    const n = normalizeEodRow(item as Record<string, unknown>);
    if (n) rows.push(n);
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function validateDividendRowsShape(rows: EodhdDividendRow[]): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (rows.length === 0) {
    issues.push("empty_array");
    return { ok: false, issues };
  }
  const sample = rows[0];
  if (!/^\d{4}-\d{2}-\d{2}/.test(sample.date)) issues.push(`bad_date_format:${sample.date}`);
  if (typeof sample.value !== "number" || sample.value <= 0) issues.push("bad_value");
  return { ok: issues.length === 0, issues };
}

export function compareWithMockExpectations(rows: EodhdDividendRow[]): { aligned: boolean; notes: string[] } {
  const notes: string[] = [`events_count=${rows.length}`];
  const values = rows.map((r) => r.value).filter((v) => v > 0);
  if (values.length === 0) return { aligned: false, notes: [...notes, "amount_range=empty"] };
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  notes.push(`amount_range=${minV.toFixed(4)}..${maxV.toFixed(4)}`);
  return { aligned: rows.length >= 1 && minV > 0 && maxV < 1_000, notes };
}
