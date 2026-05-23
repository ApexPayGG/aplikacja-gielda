-- Autopilot module: encrypted BYOK Alpaca credentials + Safe Guard risk caps (1:1 with users).
-- Does not alter Timescale hypertables (quotes, news, etc.) or legacy user_settings Alpaca columns.

CREATE TYPE "AlpacaMode" AS ENUM ('PAPER', 'LIVE');

CREATE TABLE "user_autopilot_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_autopilot_enabled" BOOLEAN NOT NULL DEFAULT false,
    "alpaca_mode" "AlpacaMode" NOT NULL DEFAULT 'PAPER',
    "alpaca_api_key_encrypted" TEXT,
    "alpaca_api_secret_encrypted" TEXT,
    "max_capital_per_trade_pct" DECIMAL(6, 4) NOT NULL DEFAULT 0.02,
    "max_daily_drawdown_pct" DECIMAL(6, 4) NOT NULL DEFAULT 0.05,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_autopilot_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_autopilot_settings_user_id_key" ON "user_autopilot_settings"("user_id");

CREATE INDEX "idx_user_autopilot_settings_enabled" ON "user_autopilot_settings"("is_autopilot_enabled");

ALTER TABLE "user_autopilot_settings"
ADD CONSTRAINT "user_autopilot_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
