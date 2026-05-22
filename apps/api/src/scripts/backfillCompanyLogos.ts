import "../load-env";
import {
  formatBackfillSummary,
  runCompanyLogoBackfill,
} from "../modules/companies/companyLogoBackfill";

function parseArgs(argv: string[]): { limit: number; dryRun: boolean; force: boolean } {
  let limit = 500;
  let dryRun = false;
  let force = false;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    if (arg === "--force") force = true;
    if (arg.startsWith("--limit=")) {
      const parsed = parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
    }
  }

  return { limit, dryRun, force };
}

async function main(): Promise<void> {
  const { limit, dryRun, force } = parseArgs(process.argv.slice(2));
  console.log(`[logos:backfill] limit=${limit} dryRun=${dryRun} force=${force}`);

  const summary = await runCompanyLogoBackfill({ limit, dryRun, force });
  console.log(formatBackfillSummary(summary));
}

main().catch((error) => {
  console.error("[logos:backfill] failed", error);
  process.exit(1);
});
