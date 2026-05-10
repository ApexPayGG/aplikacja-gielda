-- Trade Reaction Layer: comments on paper trades and signals
CREATE TABLE "trade_reactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trade_id" TEXT,
    "signal_id" TEXT,
    "content" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_reactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trade_reactions_trade_id_created_at_idx" ON "trade_reactions"("trade_id", "created_at");
CREATE INDEX "trade_reactions_signal_id_created_at_idx" ON "trade_reactions"("signal_id", "created_at");

ALTER TABLE "trade_reactions" ADD CONSTRAINT "trade_reactions_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "paper_trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_reactions" ADD CONSTRAINT "trade_reactions_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
