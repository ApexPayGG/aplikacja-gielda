-- CreateTable
CREATE TABLE "dividend_sustainability_scores" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "final_score" INTEGER NOT NULL,
    "payout_score" INTEGER NOT NULL,
    "coverage_score" INTEGER NOT NULL,
    "consistency_score" INTEGER NOT NULL,
    "payout_ratio" DOUBLE PRECISION,
    "fcf_coverage" DOUBLE PRECISION,
    "explanation" TEXT NOT NULL,
    "components_json" TEXT,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model_version" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "dividend_sustainability_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dividend_sustainability_scores_symbol_key" ON "dividend_sustainability_scores"("symbol");

-- CreateIndex
CREATE INDEX "dividend_sustainability_scores_symbol_last_calculated_at_idx" ON "dividend_sustainability_scores"("symbol", "last_calculated_at");

-- AddForeignKey
ALTER TABLE "dividend_sustainability_scores" ADD CONSTRAINT "dividend_sustainability_scores_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON UPDATE CASCADE ON DELETE RESTRICT;
