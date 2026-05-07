-- CreateTable
CREATE TABLE "live_quotes" (
    "id" BIGSERIAL NOT NULL,
    "ticker" VARCHAR(10) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "open" DECIMAL(10,2),
    "high" DECIMAL(10,2),
    "low" DECIMAL(10,2),
    "close" DECIMAL(10,2),
    "volume" BIGINT,
    "vwap" DECIMAL(10,2),
    "idempotency_key" VARCHAR(64) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_quotes_idempotency_key_key" ON "live_quotes"("idempotency_key");

-- CreateIndex
CREATE INDEX "live_quotes_ticker_idx" ON "live_quotes"("ticker");

-- CreateIndex
CREATE INDEX "live_quotes_created_at_idx" ON "live_quotes"("created_at" DESC);

-- Time-series friendly scans (works on plain Postgres and Timescale)
CREATE INDEX "live_quotes_created_at_brin_idx" ON "live_quotes" USING BRIN ("created_at");

-- Optional: TimescaleDB hypertable. Requires adjusting unique constraints to include `created_at`
-- per Timescale rules before this will succeed. See README (live data ingestion).
-- SELECT public.create_hypertable('live_quotes', 'created_at', if_not_exists => TRUE);
