-- CreateEnum
CREATE TYPE "DividendAlertType" AS ENUM ('dividend_cut', 'dividend_growth', 'anomaly', 'sector_change');

-- CreateEnum
CREATE TYPE "DividendTrendDirection" AS ENUM ('up', 'down', 'stable');

-- CreateTable
CREATE TABLE "dividend_alerts" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "alert_type" "DividendAlertType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "metric" VARCHAR(64),
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividend_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_intelligence" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "safety_score" INTEGER NOT NULL,
    "safety_reason" TEXT NOT NULL,
    "trend_direction" "DividendTrendDirection" NOT NULL,
    "sector_percentile" INTEGER NOT NULL,
    "last_analyzed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dividend_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dividend_alerts_symbol_created_at_idx" ON "dividend_alerts"("symbol", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dividend_intelligence_symbol_key" ON "dividend_intelligence"("symbol");

-- CreateIndex
CREATE INDEX "dividend_intelligence_symbol_idx" ON "dividend_intelligence"("symbol");

-- AddForeignKey
ALTER TABLE "dividend_alerts" ADD CONSTRAINT "dividend_alerts_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_intelligence" ADD CONSTRAINT "dividend_intelligence_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
