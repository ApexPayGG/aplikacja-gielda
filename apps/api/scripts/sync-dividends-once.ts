/**
 * One-shot hybrid dividend import.
 * Usage: npx tsx scripts/sync-dividends-once.ts
 */
import "../src/load-env";
import { loadTopDividendSymbols, syncDividendHistory } from "../src/services/dividendDataService";

const symbols = await loadTopDividendSymbols(100);
const out = await syncDividendHistory(symbols);
console.log(JSON.stringify(out, null, 2));
process.exit(out.synced === 0 && symbols.length > 0 ? 1 : 0);
