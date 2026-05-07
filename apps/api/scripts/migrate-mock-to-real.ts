/**
 * Backup mock_seed dividends to JSON, then populate from real APIs (hybrid).
 * Requires: DATABASE_URL, EODHD_API_KEY (and FINNHUB_API_KEY for fallback), companies seeded.
 *
 * Usage: npx tsx scripts/migrate-mock-to-real.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../src/load-env";
import { prisma } from "../src/db/index";
import { loadTopDividendSymbols, syncDividendHistory } from "../src/services/dividendDataService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "..", "results");
const backupPath = path.join(resultsDir, "dividend_mock_backup.json");

async function main() {
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const mockRows = await prisma.dividend.findMany({
    where: { source: "mock_seed" },
    orderBy: [{ symbol: "asc" }, { exDate: "asc" }],
  });

  fs.writeFileSync(
    backupPath,
    JSON.stringify({ backedUpAt: new Date().toISOString(), count: mockRows.length, rows: mockRows }, null, 2),
    "utf8",
  );
  console.log(`Backup written: ${backupPath} (${mockRows.length} rows)`);

  const symbols = await loadTopDividendSymbols(100);
  const out = await syncDividendHistory(symbols);
  console.log("Sync result:", JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
