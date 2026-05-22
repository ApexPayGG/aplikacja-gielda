import "../load-env";
import {
  formatCompanyLogoAuditJson,
  formatCompanyLogoAuditText,
  runCompanyLogoAudit,
} from "../modules/companies/companyLogoAudit";

type OutputFormat = "text" | "json";

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

function parseArgs(argv: string[]): {
  limit: number;
  symbols?: string[];
  format: OutputFormat;
  onlySuspicious: boolean;
} {
  let limit = 500;
  let format: OutputFormat = "text";
  let onlySuspicious = false;
  let symbols: string[] | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const parsed = parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
    }
    if (arg.startsWith("--symbols=")) {
      symbols = arg
        .slice("--symbols=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length).trim().toLowerCase();
      if (value === "json" || value === "text") format = value;
    }
    if (arg.startsWith("--only-suspicious=")) {
      onlySuspicious = parseBool(arg.slice("--only-suspicious=".length), onlySuspicious);
    }
    if (arg === "--only-suspicious") {
      onlySuspicious = true;
    }
  }

  return { limit, symbols, format, onlySuspicious };
}

async function main(): Promise<void> {
  const { limit, symbols, format, onlySuspicious } = parseArgs(process.argv.slice(2));
  console.error(
    `[logos:audit] read-only limit=${limit} format=${format} onlySuspicious=${onlySuspicious}${
      symbols?.length ? ` symbols=${symbols.join(",")}` : ""
    }`,
  );

  const result = await runCompanyLogoAudit({ limit, symbols, onlySuspicious });
  const output =
    format === "json"
      ? formatCompanyLogoAuditJson(result)
      : formatCompanyLogoAuditText(result);
  console.log(output);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[logos:audit] failed: ${message.slice(0, 240)}`);
  process.exit(1);
});
