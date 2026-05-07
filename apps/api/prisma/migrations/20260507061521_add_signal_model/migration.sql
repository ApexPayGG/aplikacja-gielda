-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "technical_data" JSONB NOT NULL,
    "historical_count" INTEGER,
    "win_rate" DOUBLE PRECISION,
    "avg_return_10d" DOUBLE PRECISION,
    "max_drawdown" DOUBLE PRECISION,
    "brief_pl" TEXT,
    "brief_en" TEXT,
    "score" INTEGER,
    "scoring_reasoning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_triggered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signal_ticker_created_at_idx" ON "Signal"("ticker", "created_at");

-- CreateIndex
CREATE INDEX "Signal_exchange_created_at_idx" ON "Signal"("exchange", "created_at");

-- CreateIndex
CREATE INDEX "Signal_expires_at_idx" ON "Signal"("expires_at");
