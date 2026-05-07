/**
 * Sprint 2: scoring zrównoważenia dywidendy z DB (bez AI).
 *
 * npm run sustainability:test:s2
 *
 * Opcje: SUSTAINABILITY_TEST_SYMBOLS=AAPL,MSFT,JNJ (domyślnie AAPL + do 3 z seed listy)
 */
import "../src/load-env";
import process from "node:process";
import pino from "pino";
import { calculateSustainabilityScore } from "../src/services/dividendSustainabilityMath";
import { getSeedFundamentalSymbols } from "../src/services/fundamentalDataService";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "sustainability_test_s2" },
});

function pickSymbols(): string[] {
  const raw = process.env.SUSTAINABILITY_TEST_SYMBOLS?.trim();
  if (raw) {
    return raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
  const seed = getSeedFundamentalSymbols(10).filter((s) => s !== "AAPL");
  return ["AAPL", ...seed.slice(0, 3)];
}

async function main(): Promise<void> {
  const symbols = pickSymbols();
  log.info({ msg: "run_start", symbols });

  for (const symbol of symbols) {
    const t0 = performance.now();
    try {
      const breakdown = await calculateSustainabilityScore(symbol);
      const ms = Math.round(performance.now() - t0);
      log.info({
        msg: "symbol_done",
        symbol,
        ms,
        finalScore: breakdown.finalScore,
        payoutScore: breakdown.payoutScore,
        coverageScore: breakdown.coverageScore,
        consistencyScore: breakdown.consistencyScore,
        payoutRatio: breakdown.payoutRatio,
        fcfCoverage: breakdown.fcfCoverage,
        dpsYears: breakdown.dpsHistory.length,
      });
      console.log(JSON.stringify({ symbol, ms, breakdown }, null, 2));
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      log.error({ msg: "symbol_failed", symbol, error: err });
      console.error(JSON.stringify({ symbol, error: err }, null, 2));
    }
  }

  log.info({ msg: "run_end" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
