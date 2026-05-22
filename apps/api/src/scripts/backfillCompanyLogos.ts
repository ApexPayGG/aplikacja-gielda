import "../load-env";
import {
  formatBackfillSummary,
  formatBackfillVerboseLog,
  runCompanyLogoBackfill,
} from "../modules/companies/companyLogoBackfill";

function parseArgs(argv: string[]): { limit: number; dryRun: boolean; force: boolean; verbose: boolean } {
  let limit = 500;
  let dryRun = false;
  let force = false;
  let verbose = false;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    if (arg === "--force") force = true;
    if (arg === "--verbose") verbose = true;
    if (arg.startsWith("--limit=")) {
      const parsed = parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
    }
  }

  return { limit, dryRun, force, verbose };
}

async function main(): Promise<void> {
  const { limit, dryRun, force, verbose } = parseArgs(process.argv.slice(2));
  console.log(`[logos:backfill] limit=${limit} dryRun=${dryRun} force=${force} verbose=${verbose}`);

  const result = await runCompanyLogoBackfill({ limit, dryRun, force, verbose });
  console.log(formatBackfillSummary(result.summary));

  if (verbose) {
    const detail = formatBackfillVerboseLog(result, { dryRun });
    if (detail) {
      console.log("");
      console.log(detail);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[logos:backfill] failed: ${message.slice(0, 240)}`);
  process.exit(1);
});
