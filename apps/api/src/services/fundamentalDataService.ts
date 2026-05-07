/**
 * Zapis EPS / FCF / OCF / shares z EODHD do tabeli `Fundamental` (Phase 11 Sprint 1).
 */
import process from "node:process";
import pino from "pino";
import { fetchFundamentalsEODHD } from "../scrapers/fundamentals";
import { upsertFundamental } from "../db/queries";
import { parseDividendSyncSymbols } from "./dividendDataService";

const DEFAULT_DELAY_MS = 600;

const serviceLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "fundamental_data_service" },
});

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface SyncFundamentalsSummary {
  symbolsTotal: number;
  symbolsOk: number;
  symbolsFailed: number;
  rowsUpserted: number;
  errors: Array<{ symbol: string; message: string }>;
}

async function syncOneSymbol(symbol: string): Promise<number> {
  const sym = symbol.trim().toUpperCase();
  const data = await fetchFundamentalsEODHD(sym);
  let count = 0;

  for (const row of data.records) {
    if (row.eps != null) {
      await upsertFundamental(sym, "eps", row.eps, row.year);
      count++;
    }
    if (row.fcf != null) {
      await upsertFundamental(sym, "fcf", row.fcf, row.year);
      count++;
    }
    if (row.ocf != null) {
      await upsertFundamental(sym, "ocf", row.ocf, row.year);
      count++;
    }
    if (row.shares_outstanding != null) {
      await upsertFundamental(sym, "shares_outstanding", row.shares_outstanding, row.year);
      count++;
    }
  }

  if (data.epsTtm != null) {
    await upsertFundamental(sym, "eps_ttm", data.epsTtm, 0);
    count++;
  }

  return count;
}

/**
 * Dla każdego symbolu: GET EODHD fundamentals → upsert `eps` / `fcf` / `ocf` / `shares_outstanding` (per rok) + `eps_ttm` (year=0).
 */
export async function syncFundamentalsForSymbols(symbols: string[]): Promise<SyncFundamentalsSummary> {
  const delayMs = Math.max(
    0,
    parseInt(process.env.FUNDAMENTAL_SYNC_DELAY_MS?.trim() ?? String(DEFAULT_DELAY_MS), 10) || DEFAULT_DELAY_MS,
  );

  const errors: Array<{ symbol: string; message: string }> = [];
  let symbolsOk = 0;
  let rowsUpserted = 0;

  serviceLogger.info({
    msg: "sync_start",
    symbolsTotal: symbols.filter((s) => s?.trim()).length,
    delayMs,
  });

  for (let i = 0; i < symbols.length; i++) {
    const raw = symbols[i]?.trim();
    if (!raw) continue;
    const sym = raw.toUpperCase();
    try {
      const n = await syncOneSymbol(sym);
      rowsUpserted += n;
      symbolsOk++;
      serviceLogger.info({ msg: "symbol_ok", symbol: sym, rowsUpserted: n });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ symbol: sym, message });
      serviceLogger.warn({ msg: "symbol_failed", symbol: sym, error: message });
    }
    if (i < symbols.length - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  const summary: SyncFundamentalsSummary = {
    symbolsTotal: symbols.filter((s) => s?.trim()).length,
    symbolsOk,
    symbolsFailed: errors.length,
    rowsUpserted,
    errors,
  };

  serviceLogger.info({
    msg: "sync_end",
    symbolsOk: summary.symbolsOk,
    symbolsFailed: summary.symbolsFailed,
    rowsUpserted: summary.rowsUpserted,
  });

  return summary;
}

/** Pierwsze `limit` symboli z listy seed (`DIVIDEND_SYNC_SYMBOLS` / domyślna lista). */
export function getSeedFundamentalSymbols(limit = 10): string[] {
  return parseDividendSyncSymbols().slice(0, Math.max(1, limit));
}

/** Sprint 1: sync dla top N z listy seed (domyślnie 10). */
export async function syncFundamentalsForSeedSymbols(limit = 10): Promise<SyncFundamentalsSummary> {
  const symbols = getSeedFundamentalSymbols(limit);
  return syncFundamentalsForSymbols(symbols);
}
