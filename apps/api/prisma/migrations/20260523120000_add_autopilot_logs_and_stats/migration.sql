-- Autopilot worker audit logs + per-user aggregated stats.
-- Does not alter Timescale hypertables.

CREATE TYPE "AutopilotExecutionStatus" AS ENUM ('EXECUTED', 'REJECTED_BY_SAFE_GUARD', 'SYSTEM_ERROR');

CREATE TABLE "autopilot_execution_logs" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker" VARCHAR(20) NOT NULL,
    "side" "TradeSide" NOT NULL,
    "status" "AutopilotExecutionStatus" NOT NULL,
    "reason" TEXT,
    "alpaca_order_id" TEXT,
    "calculated_qty" INTEGER NOT NULL,
    "execution_mode" "AlpacaMode" NOT NULL,
    "signal_source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autopilot_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "autopilot_execution_logs_alpaca_order_id_key" ON "autopilot_execution_logs"("alpaca_order_id");

CREATE INDEX "idx_autopilot_execution_logs_user_created" ON "autopilot_execution_logs"("user_id", "created_at" DESC);

CREATE INDEX "idx_autopilot_execution_logs_ticker" ON "autopilot_execution_logs"("ticker");

CREATE INDEX "idx_autopilot_execution_logs_status" ON "autopilot_execution_logs"("status");

CREATE TABLE "user_autopilot_stats" (
    "user_id" TEXT NOT NULL,
    "total_trades_executed" INTEGER NOT NULL DEFAULT 0,
    "last_executed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_autopilot_stats_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "autopilot_execution_logs"
ADD CONSTRAINT "autopilot_execution_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "autopilot_execution_logs"
ADD CONSTRAINT "autopilot_execution_logs_signal_source_id_fkey"
FOREIGN KEY ("signal_source_id") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_autopilot_stats"
ADD CONSTRAINT "user_autopilot_stats_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
