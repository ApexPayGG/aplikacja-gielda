/**
 * Przelicza DividendHistory (totalAmount, YoY, CAGR5Y, CAGR10Y) z tabeli Dividend dla listy symboli.
 * Usage: npx tsx scripts/populate-dividend-history.ts
 */
import "../src/load-env";
import {
  calculateAndStoreDividendHistory,
  parseDividendSyncSymbols,
} from "../src/services/dividendDataService";
import { prisma } from "../src/db/index";

const symbols = parseDividendSyncSymbols();
console.log(`Populating DividendHistory for ${symbols.length} symbols: ${symbols.join(", ")}`);

for (const sym of symbols) {
  try {
    const { yearRows } = await calculateAndStoreDividendHistory(sym);
    console.log(`[OK] ${sym} — ${yearRows} year rows`);
  } catch (e) {
    console.error(`[FAIL] ${sym}:`, e instanceof Error ? e.message : e);
  }
}

await prisma.$disconnect();
