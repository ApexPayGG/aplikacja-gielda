-- Institutional flow / MarketSignals foundation (STEP 5).
-- Does not alter existing Timescale hypertables (quotes, news, etc.).
-- If event_time partitioning is required later, promote via dedicated Timescale migration.

CREATE TABLE "market_signals" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "raw_payload" JSONB,
    "event_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "market_signals_ticker_event_time_idx" ON "market_signals"("ticker", "event_time");
CREATE INDEX "market_signals_signal_type_event_time_idx" ON "market_signals"("signal_type", "event_time");
CREATE INDEX "market_signals_ticker_signal_type_event_time_idx" ON "market_signals"("ticker", "signal_type", "event_time");
