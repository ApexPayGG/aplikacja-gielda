/**
 * EODHD Fundamentals API (Phase 11 Sprint 1 — EPS / FCF / OCF / shares).
 *
 * Domyślny URL: `https://eodhd.com/api/fundamentals/{SYMBOL}.US` (JSON, struktura zagnieżdżona).
 * Alternatywa: `EODHD_FUNDAMENTALS_API_BASE=https://eodhd.com/api/v1.1/fundamentals` (zalecane w nowszej dokumentacji).
 *
 * Pola źródłowe (demo/real):
 * - Cash flow (rocznie): `freeCashFlow`, `totalCashFromOperatingActivities` (OCF)
 * - Income + Balance (ten sam klucz okresu): EPS ≈ netIncome / `commonStockSharesOutstanding`
 * - Highlights: `EarningsShare` → eps TTM
 *
 * @see https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/
 */
import process from "node:process";
import pino from "pino";

const DEFAULT_BASE = "https://eodhd.com/api/fundamentals";

/** Filtry: jeden request; odpowiedź ma klucze typu `Financials::Cash_Flow::yearly`. */
const FUNDAMENTALS_FILTER =
  "Financials::Cash_Flow::yearly,Financials::Income_Statement::yearly,Financials::Balance_Sheet::yearly,Highlights";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1500;

export const fundamentalsLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "eodhd_fundamentals" },
});

/** Jedna linia czasu (rok fiskalny) po normalizacji — zgodne z kontraktem Sprint 1. */
export interface NormalizedFundamentalRecord {
  symbol: string;
  year: number;
  /** EPS z net income / shares (rocznie); null gdy brak danych. */
  eps: number | null;
  /** Tylko dla wiersza TTM (`year=0`) wypełnione z Highlights; w wierszach rocznych null. */
  eps_ttm: number | null;
  fcf: number | null;
  ocf: number | null;
  shares_outstanding: number | null;
  currency: string;
}

export interface FetchFundamentalsEODHDResult {
  symbol: string;
  fullSymbol: string;
  currency: string;
  /** Ostatnie `maxYears` okresów fiskalnych (malejąco po roku). */
  records: NormalizedFundamentalRecord[];
  /** Duplikat TTM z Highlights (dla wygody). */
  epsTtm: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function apiBase(): string {
  return (process.env.EODHD_FUNDAMENTALS_API_BASE?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function toEodSymbol(symbol: string, exchangeSuffix: string): string {
  const s = symbol.trim().toUpperCase();
  return `${s}${exchangeSuffix}`;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fiscalYearFromPeriodKey(key: string): number {
  const y = parseInt(key.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

type YearlyBlock = Record<string, Record<string, unknown>>;

function pickYearly(root: Record<string, unknown>, path: string): YearlyBlock | null {
  const v = root[path];
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) return null;
  const first = keys[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    return o as YearlyBlock;
  }
  return null;
}

function parsePayload(parsed: Record<string, unknown>): {
  cf: YearlyBlock | null;
  inc: YearlyBlock | null;
  bs: YearlyBlock | null;
  highlights: Record<string, unknown> | undefined;
  general: Record<string, unknown> | undefined;
} {
  return {
    cf: pickYearly(parsed, "Financials::Cash_Flow::yearly"),
    inc: pickYearly(parsed, "Financials::Income_Statement::yearly"),
    bs: pickYearly(parsed, "Financials::Balance_Sheet::yearly"),
    highlights: parsed["Highlights"] as Record<string, unknown> | undefined,
    general: parsed["General"] as Record<string, unknown> | undefined,
  };
}

/**
 * GET EODHD fundamentals → rekordy roczne + eps TTM.
 */
export async function fetchFundamentalsEODHD(symbol: string, maxYears = 12): Promise<FetchFundamentalsEODHDResult> {
  const suffix = process.env.EODHD_FUNDAMENTALS_EXCHANGE?.trim() || ".US";
  const fullSymbol = toEodSymbol(symbol, suffix);
  const token =
    process.env.EODHD_API_KEY?.trim() ||
    (process.env.DIVIDEND_EODHD_DEMO === "1" && fullSymbol === "AAPL.US" ? "demo" : "");
  if (!token) {
    throw new Error("EODHD_API_KEY is not set (or DIVIDEND_EODHD_DEMO=1 for AAPL.US demo only)");
  }

  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
    filter: FUNDAMENTALS_FILTER,
  });
  const url = `${apiBase()}/${encodeURIComponent(fullSymbol)}?${params.toString()}`;

  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      fundamentalsLogger.info({ msg: "fetch_start", symbol: symbol.toUpperCase(), fullSymbol, attempt, url: apiBase() });
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        lastErr = new Error(`EODHD fundamentals HTTP ${res.status}: ${text.slice(0, 400)}`);
        fundamentalsLogger.warn({
          msg: "fetch_http_error",
          status: res.status,
          symbol: symbol.toUpperCase(),
          attempt,
          bodyPreview: text.slice(0, 200),
        });
        if (res.status === 429 || res.status >= 500) {
          await sleep(INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
          continue;
        }
        throw lastErr;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error(`EODHD fundamentals invalid JSON: ${text.slice(0, 200)}`);
      }

      const { cf, inc, bs, highlights, general } = parsePayload(parsed);

      const currency =
        (typeof highlights?.currency_symbol === "string" && highlights.currency_symbol) ||
        (typeof general?.CurrencyCode === "string" && general.CurrencyCode) ||
        "USD";

      const epsTtm = parseNum(highlights?.EarningsShare);

      const periodKeys = new Set<string>([
        ...Object.keys(cf ?? {}),
        ...Object.keys(inc ?? {}),
        ...Object.keys(bs ?? {}),
      ]);

      const sorted = [...periodKeys].sort((a, b) => b.localeCompare(a));
      const take = sorted.slice(0, Math.max(1, maxYears));

      const records: NormalizedFundamentalRecord[] = [];
      const sym = symbol.trim().toUpperCase();

      for (const pk of take) {
        const cfr = cf?.[pk];
        const ir = inc?.[pk];
        const br = bs?.[pk];
        const fcf = parseNum(cfr?.freeCashFlow);
        const ocf = parseNum(cfr?.totalCashFromOperatingActivities);
        const shares = parseNum(br?.commonStockSharesOutstanding);
        const netIncome = parseNum(ir?.netIncomeApplicableToCommonShares ?? ir?.netIncome);
        const eps = netIncome !== null && shares !== null && shares > 0 ? netIncome / shares : null;

        records.push({
          symbol: sym,
          year: fiscalYearFromPeriodKey(pk),
          eps,
          eps_ttm: null,
          fcf,
          ocf,
          shares_outstanding: shares,
          currency: typeof cfr?.currency_symbol === "string" ? String(cfr.currency_symbol) : currency,
        });
      }

      fundamentalsLogger.info({
        msg: "fetch_ok",
        symbol: sym,
        fullSymbol,
        periods: records.length,
        epsTtm,
      });

      return {
        symbol: sym,
        fullSymbol,
        currency,
        records,
        epsTtm,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      fundamentalsLogger.error({
        msg: "fetch_attempt_failed",
        symbol: symbol.toUpperCase(),
        attempt,
        err: lastErr.message,
      });
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  }

  throw lastErr ?? new Error("fetchFundamentalsEODHD failed");
}
