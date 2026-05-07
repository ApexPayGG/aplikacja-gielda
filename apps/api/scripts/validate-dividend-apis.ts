/**
 * Smoke-test EODHD demo (no key) + optional Finnhub (requires FINNHUB_API_KEY).
 * Usage: npx tsx scripts/validate-dividend-apis.ts
 */
import "../src/load-env";
import process from "node:process";
import {
  fetchDividendHistoryRaw,
  fetchDividendHistoryFinnhub,
  mapEodhdToNormalized,
  validateDividendRowsShape,
} from "../src/scrapers/dividends";
import { filterValidNormalizedDividends } from "../src/services/dividendValidation";

console.log("--- EODHD demo (AAPL.US, no paid key) ---");
const eodRaw = await fetchDividendHistoryRaw({
  fullSymbol: "AAPL.US",
  from: "2023-01-01",
  allowDemo: true,
});
const shape = validateDividendRowsShape(eodRaw);
console.log("rows:", eodRaw.length, "shapeOk:", shape.ok, shape.issues);
const norm = eodRaw.map(mapEodhdToNormalized);
const q = filterValidNormalizedDividends(norm);
console.log("quality:", q.report);

if (process.env.FINNHUB_API_KEY?.trim()) {
  console.log("--- Finnhub (IBM, 10y) ---");
  try {
    const prev = process.env.EODHD_DIVIDEND_FROM_YEAR;
    delete process.env.EODHD_DIVIDEND_FROM_YEAR;
    const fh = await fetchDividendHistoryFinnhub("IBM", 10);
    process.env.EODHD_DIVIDEND_FROM_YEAR = prev;
    console.log("finnhub rows:", fh.length, "sample:", fh.slice(-1)[0]);
  } catch (e) {
    console.error("Finnhub failed:", e instanceof Error ? e.message : e);
  }
} else {
  console.log("--- Finnhub skipped (no FINNHUB_API_KEY) ---");
}
