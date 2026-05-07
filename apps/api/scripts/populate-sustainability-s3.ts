/**
 * Sprint 3: oblicz scoring + zapis do `DividendSustainabilityScore` dla seed symboli.
 *
 * npm run sustainability:populate:s3
 *
 * Wymaga: DATABASE_URL, dane Fundamental + DividendHistory; symbol musi istnieć w `companies` (FK).
 * Opcje: FUNDAMENTAL_S1_LIMIT=10 (lista seed jak w fundamentals S1)
 */
import "../src/load-env";
import process from "node:process";
import pino from "pino";
import { calculateSustainabilityScore } from "../src/services/dividendSustainabilityMath";
import { saveSustainabilityScore } from "../src/services/dividendSustainabilityPersistenceService";
import { getSeedFundamentalSymbols } from "../src/services/fundamentalDataService";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "sustainability_populate_s3" },
});

async function main(): Promise<void> {
  const limit = Math.min(20, Math.max(1, parseInt(process.env.FUNDAMENTAL_S1_LIMIT ?? "10", 10) || 10));
  const symbols = getSeedFundamentalSymbols(limit);
  log.info({ msg: "start", symbols, count: symbols.length });

  let saved = 0;
  const errors: Array<{ symbol: string; message: string }> = [];

  for (const sym of symbols) {
    try {
      const breakdown = await calculateSustainabilityScore(sym);
      await saveSustainabilityScore(sym, breakdown);
      saved++;
      log.info({ msg: "saved", symbol: sym, finalScore: breakdown.finalScore });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ symbol: sym, message });
      log.warn({ msg: "failed", symbol: sym, error: message });
    }
  }

  console.log(`[sustainability:populate:s3] saved=${saved} failed=${errors.length} total=${symbols.length}`);
  for (const err of errors) {
    console.error(`  ${err.symbol}: ${err.message}`);
  }
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
