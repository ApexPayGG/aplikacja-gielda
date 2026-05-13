import type { Dividend, DividendHistory } from "@prisma/client";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { prisma } from "../db/index";

const PL_DIVIDEND_TAX_RATE = 0.19;

export type DividendHistoryRow = Pick<Dividend, "exDate" | "payDate" | "amount" | "yield">;

export function serializeDividendRow(d: Dividend): DividendHistoryRow {
  return {
    exDate: d.exDate,
    payDate: d.payDate,
    amount: d.amount,
    yield: d.yield,
  };
}

export async function getDividendHistory(symbol: string, years: number): Promise<DividendHistoryRow[]> {
  const sym = symbol.trim().toUpperCase();
  const y = Math.min(30, Math.max(1, years));
  const cacheKey = redisKeys.dividendHistory(sym, y);

  const cached = await cacheJsonGet<DividendHistoryRow[]>(cacheKey);
  if (cached !== null) {
    return cached.map((row) => ({
      exDate: new Date(row.exDate as unknown as string),
      payDate: new Date(row.payDate as unknown as string),
      amount: row.amount,
      yield: row.yield,
    }));
  }

  const since = new Date();
  since.setFullYear(since.getFullYear() - y);

  const rows = await prisma.dividend.findMany({
    where: { symbol: sym, exDate: { gte: since } },
    orderBy: { exDate: "desc" },
  });

  const out = rows.map(serializeDividendRow);
  await cacheJsonSet(cacheKey, out, REDIS_TTL_SEC.DIVIDEND);
  return out;
}

export interface GrowthScreenerFilters {
  minYears: number;
  minYield: number;
  limit: number;
  offset: number;
  /** Gdy true — zwróć `debug` z licznikami filtrów (endpoint `?debug=1`). */
  includeDebug?: boolean;
}

/** Diagnostyka screenera (brak danych / filtry). */
export interface GrowthScreenerDebug {
  /** Liczba unikalnych symboli z rekordami w `DividendHistory` (pętla filtrów). */
  symbolsProcessed: number;
  dividendHistoryRows: number;
  excludedByMinYears: number;
  excludedByYieldBelowMin: number;
  /** Ile symboli ma yield=null (minYield nie stosuje się — nie wykluczamy). */
  symbolsWithUnknownYield: number;
  candidatesBeforeSlice: number;
}

export interface GrowthScreenerItem {
  symbol: string;
  latestYear: number;
  totalAmount: number;
  growthYoY: number | null;
  cagr5Y: number | null;
  cagr10Y: number | null;
  latestYield: number | null;
}

function computeYoYGrowth(rowsAsc: Array<{ totalAmount: number }>): number | null {
  if (rowsAsc.length < 2) return null;
  const latest = Number(rowsAsc[rowsAsc.length - 1]?.totalAmount ?? Number.NaN);
  const prev = Number(rowsAsc[rowsAsc.length - 2]?.totalAmount ?? Number.NaN);
  if (!Number.isFinite(latest) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((latest - prev) / prev) * 100;
}

function computeCagr(rowsAsc: Array<{ totalAmount: number }>, requiredYears: number): number | null {
  if (rowsAsc.length < requiredYears) return null;
  const latest = Number(rowsAsc[rowsAsc.length - 1]?.totalAmount ?? Number.NaN);
  const base = Number(rowsAsc[rowsAsc.length - requiredYears]?.totalAmount ?? Number.NaN);
  const periods = requiredYears - 1;
  if (!Number.isFinite(latest) || !Number.isFinite(base) || base <= 0 || latest <= 0 || periods <= 0) return null;
  return (Math.pow(latest / base, 1 / periods) - 1) * 100;
}

export async function searchGrowthScreener(filters: GrowthScreenerFilters): Promise<{
  items: GrowthScreenerItem[];
  total: number;
  debug?: GrowthScreenerDebug;
}> {
  const { minYears, minYield, limit, offset, includeDebug } = filters;
  const cacheKey = redisKeys.screenerDividendGrowth({ minYears, minYield, limit, offset });

  if (!includeDebug) {
    const cached = await cacheJsonGet<{ items: GrowthScreenerItem[]; total: number }>(cacheKey);
    if (cached && Array.isArray(cached.items) && typeof cached.total === "number") {
      return cached;
    }
  }

  const histories = await prisma.dividendHistory.findMany({
    orderBy: [{ symbol: "asc" }, { year: "asc" }],
  });

  const bySymbol = new Map<string, DividendHistory[]>();
  for (const h of histories) {
    const list = bySymbol.get(h.symbol) ?? [];
    list.push(h);
    bySymbol.set(h.symbol, list);
  }

  const symbols = [...bySymbol.keys()];
  const latestQuotes = symbols.length
    ? await prisma.quote.findMany({
        where: {
          symbol: {
            in: symbols,
          },
        },
        orderBy: [{ symbol: "asc" }, { timestamp: "desc" }],
        select: { symbol: true, close: true },
      })
    : [];
  const latestCloseBySymbol = new Map<string, number | null>();
  for (const q of latestQuotes) {
    if (!latestCloseBySymbol.has(q.symbol)) {
      latestCloseBySymbol.set(q.symbol, Number(q.close));
    }
  }

  const candidates: GrowthScreenerItem[] = [];
  let excludedByMinYears = 0;
  let excludedByYieldBelowMin = 0;
  let symbolsWithUnknownYield = 0;

  for (const [symbol, rows] of bySymbol) {
    if (rows.length < minYears) {
      excludedByMinYears++;
      continue;
    }
    const ly = rows[rows.length - 1];
    const yoy = computeYoYGrowth(rows);
    const cagr5Y = computeCagr(rows, 5);
    const cagr10Y = computeCagr(rows, 10);
    const latestClose = latestCloseBySymbol.get(symbol) ?? null;
    const latestAmount = Number(ly?.totalAmount ?? Number.NaN);
    const yld =
      latestClose !== null && Number.isFinite(latestClose) && latestClose > 0 && Number.isFinite(latestAmount)
        ? (latestAmount / latestClose) * 100
        : null;
    if (yld === null) {
      symbolsWithUnknownYield++;
    }
    // minYield tylko gdy mamy yield z ostatniej dywidendy (EODHD/Finnhub często null — nie wykluczaj całej listy)
    if (yld !== null && yld < minYield) {
      excludedByYieldBelowMin++;
      continue;
    }

    candidates.push({
      symbol,
      latestYear: ly.year,
      totalAmount: ly.totalAmount,
      growthYoY: yoy,
      cagr5Y,
      cagr10Y,
      latestYield: yld,
    });
  }

  candidates.sort((a, b) => (b.cagr5Y ?? -999) - (a.cagr5Y ?? -999));
  const total = candidates.length;
  const items = candidates.slice(offset, offset + limit);

  const debug: GrowthScreenerDebug | undefined = includeDebug
    ? {
        symbolsProcessed: bySymbol.size,
        dividendHistoryRows: histories.length,
        excludedByMinYears,
        excludedByYieldBelowMin,
        symbolsWithUnknownYield,
        candidatesBeforeSlice: candidates.length,
      }
    : undefined;

  if (!includeDebug) {
    const payload = { items, total };
    await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.SCREENER);
  }

  return debug ? { items, total, debug } : { items, total };
}

export interface TaxPLResult {
  grossDividend: number;
  taxAmount: number;
  netIncome: number;
  taxRate: number;
}

export function calculateTaxPL(grossDividend: number): TaxPLResult {
  const gross = Math.max(0, grossDividend);
  const taxAmount = Math.round(gross * PL_DIVIDEND_TAX_RATE * 100) / 100;
  const netIncome = Math.round((gross - taxAmount) * 100) / 100;
  return {
    grossDividend: Math.round(gross * 100) / 100,
    taxAmount,
    netIncome,
    taxRate: PL_DIVIDEND_TAX_RATE,
  };
}

/** Szacunek dywidendy brutto: akcje × dywidenda na akcję LUB akcje × cena × (yield%/100). */
export function estimateGrossDividend(params: {
  shares: number;
  currentPrice: number;
  dividendPerShare?: number;
  annualDividendYieldPercent?: number;
}): { grossDividend: number; method: string } {
  const shares = Math.max(0, params.shares);
  const price = Math.max(0, params.currentPrice);
  if (params.dividendPerShare !== undefined && params.dividendPerShare >= 0) {
    return {
      grossDividend: shares * params.dividendPerShare,
      method: "shares × dividendPerShare",
    };
  }
  if (params.annualDividendYieldPercent !== undefined && params.annualDividendYieldPercent >= 0) {
    return {
      grossDividend: shares * price * (params.annualDividendYieldPercent / 100),
      method: "shares × price × (yield%/100)",
    };
  }
  throw new Error("Podaj dividendPerShare lub annualDividendYieldPercent (obok shares i currentPrice).");
}
