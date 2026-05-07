/**
 * Ręczny sync fundamentals (EODHD → `Fundamental`).
 * Wymaga: EODHD_API_KEY, DATABASE_URL, (opcj.) REDIS_URL — sam skrypt nie używa Redis.
 *
 * Usage: npm run fundamentals:sync
 * Opcje env: DIVIDEND_SYNC_SYMBOLS=AAPL,MSFT lub domyślnie top z DB (loadTopDividendSymbols).
 */
import "../src/load-env";
import process from "node:process";
import { loadTopDividendSymbols } from "../src/services/dividendDataService";
import { syncFundamentalsForSymbols } from "../src/services/fundamentalDataService";

function parseSymbolsFromEnv(): string[] | null {
  const raw = process.env.DIVIDEND_SYNC_SYMBOLS?.trim() || process.env.FUNDAMENTAL_SYNC_SYMBOLS?.trim();
  if (!raw) return null;
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const explicit = parseSymbolsFromEnv();
  const symbols = explicit ?? (await loadTopDividendSymbols(100));
  console.log(`[fundamentals:sync] symbols=${symbols.length} (${explicit ? "env" : "db-top"})`);

  const out = await syncFundamentalsForSymbols(symbols);
  console.log(
    `[fundamentals:sync] ok=${out.symbolsOk} failed=${out.symbolsFailed} rowsUpserted=${out.rowsUpserted} total=${out.symbolsTotal}`,
  );
  if (out.errors.length > 0) {
    console.error("[fundamentals:sync] errors (first 10):");
    for (const e of out.errors.slice(0, 10)) {
      console.error(`  ${e.symbol}: ${e.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
