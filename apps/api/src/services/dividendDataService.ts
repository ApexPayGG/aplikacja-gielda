/**
 * Dividend sync: hybrid EODHD + Finnhub → normalized rows → Prisma Dividend + DividendHistory.
 */
import process from "node:process";
import { prisma } from "../db/index";
import {
  dividendLog,
  fetchDividendHistoryHybrid,
  type NormalizedDividendRow,
} from "../scrapers/dividends";
import { isRedisConfigured } from "../config/redis";
import { getCacheRedis } from "../redis";
import { filterValidNormalizedDividends } from "./dividendValidation";

const REPLACE_SOURCES = ["mock_seed", "eodhd", "finnhub", "hybrid"] as const;

export function computeCagr(start: number, end: number, years: number): number | null {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return Math.round((Math.pow(end / start, 1 / years) - 1) * 10000) / 100;
}

/** Z rekordów Dividend (ex-date) → suma wypłat per rok kalendarzowy (UTC). */
export function aggregateYearlyTotalsFromDividends(
  dividends: Array<{ exDate: Date; amount: number }>,
): Map<number, number> {
  const byYear = new Map<number, number>();
  for (const d of dividends) {
    const y = d.exDate.getUTCFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + d.amount);
  }
  return byYear;
}

export interface DividendHistoryComputed {
  year: number;
  totalAmount: number;
  growthYoY: number | null;
  cagr5Y: number | null;
  cagr10Y: number | null;
}

/**
 * CAGR5Y / CAGR10Y vs dokładnie 5 / 10 lat kalendarzowych wstecz (Y-5, Y-10).
 * YoY: porównanie z rokiem kalendarzowym Y-1 (nie „poprzedni wiersz” przy lukach w latach).
 */
export function buildDividendHistoryRecords(sortedYears: number[], byYear: Map<number, number>): DividendHistoryComputed[] {
  return sortedYears.map((year) => {
    const totalAmount = Math.round((byYear.get(year) ?? 0) * 10000) / 10000;

    const prevCal = byYear.get(year - 1);
    const growthYoY =
      prevCal !== undefined && prevCal > 0
        ? Math.round(((totalAmount - prevCal) / prevCal) * 10000) / 100
        : null;

    const start5 = byYear.get(year - 5);
    const cagr5Y =
      start5 !== undefined && start5 > 0 && totalAmount > 0 ? computeCagr(start5, totalAmount, 5) : null;

    const start10 = byYear.get(year - 10);
    const cagr10Y =
      start10 !== undefined && start10 > 0 && totalAmount > 0 ? computeCagr(start10, totalAmount, 10) : null;

    return { year, totalAmount, growthYoY, cagr5Y, cagr10Y };
  });
}

async function invalidateCachesForSymbol(symbol: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const r = getCacheRedis();
    const sym = symbol.toUpperCase();
    const keys: string[] = [];
    for (let y = 1; y <= 30; y++) {
      keys.push(`cache:v1:dividend:history:${sym}:${y}`);
    }
    if (keys.length) await r.del(...keys);
    let cur = "0";
    do {
      const [next, found] = await r.scan(cur, "MATCH", "cache:v1:screener:dividend:growth:*", "COUNT", "500");
      cur = next;
      if (found.length) await r.del(...found);
    } while (cur !== "0");
  } catch {
    /* ignore */
  }
}

function aggregateYearlyTotals(rows: NormalizedDividendRow[]): Map<number, number> {
  return aggregateYearlyTotalsFromDividends(rows.map((r) => ({ exDate: r.exDate, amount: r.amount })));
}

export interface SyncOneSymbolResult {
  symbol: string;
  dividendRows: number;
  historyYears: number;
  usedFinnhubFallback: boolean;
  warnings: string[];
}

/**
 * Upsert pipeline: remove prior mock/API rows for symbol, insert fresh dividends + computed DividendHistory.
 */
export async function persistNormalizedDividends(
  symbol: string,
  rows: NormalizedDividendRow[],
  _meta?: { usedFinnhubFallback?: boolean },
): Promise<SyncOneSymbolResult> {
  const sym = symbol.trim().toUpperCase();
  const company = await prisma.company.findUnique({ where: { symbol: sym } });
  if (!company) {
    dividendLog("warn", "skip_no_company", { symbol: sym });
    throw new Error(`Company not found: ${sym}`);
  }

  const { valid, report } = filterValidNormalizedDividends(rows);
  if (!report.ok) {
    dividendLog("warn", "no_valid_dividend_rows", { symbol: sym, issues: report.issues });
    throw new Error(`No valid dividend rows for ${sym}`);
  }

  const byYear = aggregateYearlyTotals(valid);
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const historyRows = buildDividendHistoryRecords(years, byYear);

  await prisma.$transaction(async (tx) => {
    await tx.dividend.deleteMany({ where: { symbol: sym, source: { in: [...REPLACE_SOURCES] } } });
    await tx.dividendHistory.deleteMany({ where: { symbol: sym } });

    for (const row of valid) {
      await tx.dividend.create({
        data: {
          symbol: sym,
          exDate: row.exDate,
          payDate: row.payDate,
          amount: row.amount,
          currency: row.currency,
          yield: null,
          frequency: row.frequency,
          source: row.source,
        },
      });
    }

    for (const h of historyRows) {
      await tx.dividendHistory.create({
        data: {
          symbol: sym,
          year: h.year,
          totalAmount: h.totalAmount,
          growthYoY: h.growthYoY,
          cagr5Y: h.cagr5Y,
          cagr10Y: h.cagr10Y,
        },
      });
    }
  });

  await invalidateCachesForSymbol(sym);

  return {
    symbol: sym,
    dividendRows: valid.length,
    historyYears: historyRows.length,
    usedFinnhubFallback: Boolean(_meta?.usedFinnhubFallback),
    warnings: report.issues,
  };
}

/**
 * Przelicza `DividendHistory` wyłącznie z istniejących wierszy `Dividend` (bez zmiany dywidend).
 * Użyteczne po imporcie lub naprawie CAGR.
 */
export async function calculateAndStoreDividendHistory(symbol: string): Promise<{ symbol: string; yearRows: number }> {
  const sym = symbol.trim().toUpperCase();
  const divs = await prisma.dividend.findMany({
    where: { symbol: sym },
    select: { exDate: true, amount: true },
    orderBy: { exDate: "asc" },
  });

  if (divs.length === 0) {
    dividendLog("warn", "no_dividends_for_history", { symbol: sym });
    await prisma.dividendHistory.deleteMany({ where: { symbol: sym } });
    await invalidateCachesForSymbol(sym);
    return { symbol: sym, yearRows: 0 };
  }

  const byYear = aggregateYearlyTotalsFromDividends(divs);
  const sortedYears = [...byYear.keys()].sort((a, b) => a - b);
  const historyRows = buildDividendHistoryRecords(sortedYears, byYear);

  await prisma.$transaction(async (tx) => {
    await tx.dividendHistory.deleteMany({ where: { symbol: sym } });
    if (historyRows.length > 0) {
      await tx.dividendHistory.createMany({
        data: historyRows.map((h) => ({
          symbol: sym,
          year: h.year,
          totalAmount: h.totalAmount,
          growthYoY: h.growthYoY,
          cagr5Y: h.cagr5Y,
          cagr10Y: h.cagr10Y,
        })),
      });
    }
  });

  await invalidateCachesForSymbol(sym);
  dividendLog("info", "dividend_history_calculated", { symbol: sym, yearRows: historyRows.length });
  return { symbol: sym, yearRows: historyRows.length };
}

export async function syncOneSymbolDividends(symbol: string, years: number): Promise<SyncOneSymbolResult> {
  const { rows, usedFinnhubFallback, warnings } = await fetchDividendHistoryHybrid(symbol, years);
  const persisted = await persistNormalizedDividends(symbol, rows, { usedFinnhubFallback });
  return { ...persisted, warnings: [...warnings, ...persisted.warnings] };
}

export function parseDividendSyncSymbols(): string[] {
  const raw = process.env.DIVIDEND_SYNC_SYMBOLS?.trim();
  const def = "AAPL,MSFT,JNJ,PG,KO,PEP,VZ,XOM,CVX,MMM";
  const list = (raw || def)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export async function loadTopDividendSymbols(limit = 100): Promise<string[]> {
  const envList = parseDividendSyncSymbols();
  if (process.env.DIVIDEND_SYNC_USE_DB_TOP !== "1" && process.env.DIVIDEND_SYNC_USE_DB_TOP !== "true") {
    return envList.slice(0, limit);
  }
  const rows = await prisma.company.findMany({
    select: { symbol: true },
    orderBy: { symbol: "asc" },
    take: limit,
  });
  return rows.map((r) => r.symbol);
}

/**
 * Loop symbols: partial success — each symbol independent; failures logged, others continue.
 */
export async function syncDividendHistory(symbols: string[]): Promise<{
  synced: number;
  failed: number;
  results: Array<{ symbol: string; ok: boolean; error?: string }>;
}> {
  const years = Math.min(40, Math.max(1, parseInt(process.env.DIVIDEND_SYNC_YEARS ?? "10", 10) || 10));
  const delayMs = Math.max(0, parseInt(process.env.DIVIDEND_SYNC_DELAY_MS ?? "600", 10) || 600);
  const results: Array<{ symbol: string; ok: boolean; error?: string }> = [];
  let synced = 0;
  let failed = 0;

  for (const sym of symbols) {
    try {
      await syncOneSymbolDividends(sym, years);
      synced++;
      results.push({ symbol: sym, ok: true });
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      dividendLog("error", "symbol_sync_failed", { symbol: sym, error: msg });
      results.push({ symbol: sym, ok: false, error: msg });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  dividendLog("info", "sync_dividend_history_done", { synced, failed, total: symbols.length });
  return { synced, failed, results };
}

/** @deprecated use syncDividendHistory(parseDividendSyncSymbols()) */
export async function runDailyDividendEodhdSync(): Promise<void> {
  const symbols = await loadTopDividendSymbols(100);
  await syncDividendHistory(symbols);
}
