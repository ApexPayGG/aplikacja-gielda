-- CreateEnum
CREATE TYPE "ExitAction" AS ENUM ('HOLD', 'EXIT_NOW', 'TIGHTEN_SL', 'SCALE_OUT');

-- CreateEnum
CREATE TYPE "ExitUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "exit_signals" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "action" "ExitAction" NOT NULL,
    "urgency" "ExitUrgency" NOT NULL,
    "pnl_pct" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exit_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exit_signals_trade_id_created_at_idx" ON "exit_signals"("trade_id", "created_at");

-- CreateIndex
CREATE INDEX "exit_signals_ticker_created_at_idx" ON "exit_signals"("ticker", "created_at");
