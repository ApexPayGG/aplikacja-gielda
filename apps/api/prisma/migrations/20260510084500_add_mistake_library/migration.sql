CREATE TABLE "mistake_library" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "trade_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "pnl" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mistake_library_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mistake_library_user_id_created_at_idx" ON "mistake_library"("user_id", "created_at");
CREATE INDEX "mistake_library_trade_id_idx" ON "mistake_library"("trade_id");
