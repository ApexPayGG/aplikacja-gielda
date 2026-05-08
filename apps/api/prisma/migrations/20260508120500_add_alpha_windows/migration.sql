-- CreateEnum
CREATE TYPE "AlphaWindowType" AS ENUM ('EARNINGS_CYCLE', 'SEASONAL', 'SECTOR_ROTATION', 'REGIME_SHIFT');

-- CreateTable
CREATE TABLE "alpha_windows" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "type" "AlphaWindowType" NOT NULL,
    "probability_score" INTEGER NOT NULL,
    "historical_avg_return" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "ai_note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alpha_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alpha_windows_ticker_created_at_idx" ON "alpha_windows"("ticker", "created_at");

-- CreateIndex
CREATE INDEX "alpha_windows_type_probability_score_idx" ON "alpha_windows"("type", "probability_score");
