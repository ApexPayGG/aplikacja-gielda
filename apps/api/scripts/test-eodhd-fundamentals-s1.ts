/**
 * Test fetch (bez DB) — odpowiednik „curl” na 2–3 tickery.
 *
 * npm run fundamentals:test:s1
 * Opcje: FUNDAMENTAL_TEST_SYMBOLS=AAPL,MSFT,JNJ
 *
 * Przy samym tokenie `demo` EODHD zwykle działa w pełni tylko dla AAPL.US — pozostałe mogą zwrócić 403.
 */
import "../src/load-env";
import process from "node:process";
import { fetchFundamentalsEODHD } from "../src/scrapers/fundamentals";

const DEFAULT = ["AAPL", "MSFT", "JNJ"];

function symbolList(): string[] {
  const raw = process.env.FUNDAMENTAL_TEST_SYMBOLS?.trim();
  if (raw) {
    return raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  return DEFAULT;
}

async function main(): Promise<void> {
  const syms = symbolList();
  console.log(`[fundamentals:test:s1] symbols=${syms.join(",")}`);

  let failed = 0;
  for (const sym of syms) {
    try {
      const d = await fetchFundamentalsEODHD(sym, 3);
      const sample = d.records.slice(0, 3).map((r) => ({
        year: r.year,
        eps: r.eps,
        eps_ttm: r.eps_ttm,
        fcf: r.fcf,
        ocf: r.ocf,
        shares_outstanding: r.shares_outstanding,
      }));
      console.log(JSON.stringify({ symbol: d.symbol, epsTtm: d.epsTtm, currency: d.currency, sample }, null, 2));
    } catch (e) {
      failed++;
      console.error(
        JSON.stringify({ symbol: sym, error: e instanceof Error ? e.message : String(e) }, null, 2),
      );
    }
  }

  if (failed > 0) {
    console.error(`[fundamentals:test:s1] done with ${failed}/${syms.length} failures`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
