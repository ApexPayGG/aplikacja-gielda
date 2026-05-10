-- Decision audit trail (Pre-Mortem proceed, closed losses)
CREATE TABLE "decision_receipts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paper_trade_id" TEXT,
    "kind" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_receipts_user_id_created_at_idx" ON "decision_receipts"("user_id", "created_at" DESC);
