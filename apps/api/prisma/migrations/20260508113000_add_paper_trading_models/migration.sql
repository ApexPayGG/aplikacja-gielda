-- CreateEnum
CREATE TYPE "PaperTradeDirection" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "PaperTradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "paper_trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" "PaperTradeDirection" NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "exit_price" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exit_at" TIMESTAMP(3),
    "status" "PaperTradeStatus" NOT NULL,
    "pnl" DOUBLE PRECISION,
    "pnl_pct" DOUBLE PRECISION,
    "signal_id" TEXT,
    "market_regime" TEXT,
    CONSTRAINT "paper_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "biases" JSONB NOT NULL,
    "avg_win_pct" DOUBLE PRECISION NOT NULL,
    "avg_loss_pct" DOUBLE PRECISION NOT NULL,
    "avg_holding_win_hours" DOUBLE PRECISION NOT NULL,
    "avg_holding_loss_hours" DOUBLE PRECISION NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "behavioral_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paper_trades_user_id_status_entry_at_idx" ON "paper_trades"("user_id", "status", "entry_at");

-- CreateIndex
CREATE INDEX "paper_trades_user_id_exit_at_idx" ON "paper_trades"("user_id", "exit_at");

-- CreateIndex
CREATE INDEX "behavioral_snapshots_user_id_calculated_at_idx" ON "behavioral_snapshots"("user_id", "calculated_at");
