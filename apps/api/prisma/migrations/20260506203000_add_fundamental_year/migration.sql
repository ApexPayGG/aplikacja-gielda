-- AlterTable: rok fiskalny dla metryk Phase 11 (eps / fcf / ocf); year=0 dla eps_ttm
ALTER TABLE "fundamentals" ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL DEFAULT 0;

-- Drop old unique (symbol, metric)
DROP INDEX IF EXISTS "fundamentals_symbol_metric_key";

-- New unique (symbol, metric, year)
CREATE UNIQUE INDEX "fundamentals_symbol_metric_year_key" ON "fundamentals"("symbol", "metric", "year");
