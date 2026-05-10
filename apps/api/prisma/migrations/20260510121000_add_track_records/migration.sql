-- CreateTable
CREATE TABLE "track_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_hash" TEXT NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL,
    "total_trades" INTEGER NOT NULL,
    "avg_return" DOUBLE PRECISION NOT NULL,
    "best_trade_pct" DOUBLE PRECISION NOT NULL,
    "worst_trade_pct" DOUBLE PRECISION NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "track_records_public_hash_key" ON "track_records"("public_hash");

-- CreateIndex
CREATE INDEX "track_records_user_id_generated_at_idx" ON "track_records"("user_id", "generated_at");
