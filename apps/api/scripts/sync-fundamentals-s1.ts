/**
 * Sprint 1: sync fundamentals dla pierwszych 10 symboli z listy seed.
 *
 * npm run fundamentals:sync:s1
 */
import "../src/load-env";
import process from "node:process";
import { syncFundamentalsForSeedSymbols } from "../src/services/fundamentalDataService";

async function main(): Promise<void> {
  const limit = Math.min(20, Math.max(1, parseInt(process.env.FUNDAMENTAL_S1_LIMIT ?? "10", 10) || 10));
  console.log(`[fundamentals:sync:s1] limit=${limit} (FUNDAMENTAL_S1_LIMIT)`);

  const out = await syncFundamentalsForSeedSymbols(limit);
  console.log(
    `[fundamentals:sync:s1] synced=${out.symbolsOk} failed=${out.symbolsFailed} rowsUpserted=${out.rowsUpserted} total=${out.symbolsTotal}`,
  );
  if (out.errors.length > 0) {
    console.error("[fundamentals:sync:s1] errors:");
    for (const e of out.errors) {
      console.error(`  ${e.symbol}: ${e.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
