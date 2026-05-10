-- Trader Psyche: profile, decision journal, trading rules, rule breaches
CREATE TABLE "trader_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "top_biases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "trading_style" TEXT,
    "good_conditions" TEXT,
    "bad_conditions" TEXT,
    "growth_score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trader_profiles_user_id_key" ON "trader_profiles"("user_id");

CREATE TABLE "decision_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trade_id" TEXT,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "mood" TEXT,
    "reasoning" TEXT,
    "plan_compliance" BOOLEAN,
    "outcome" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_logs_user_id_created_at_idx" ON "decision_logs"("user_id", "created_at" DESC);

CREATE TABLE "trading_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "breaches" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trading_rules_user_id_active_idx" ON "trading_rules"("user_id", "active");

CREATE TABLE "rule_breaches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_breaches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rule_breaches_user_id_created_at_idx" ON "rule_breaches"("user_id", "created_at" DESC);
CREATE INDEX "rule_breaches_rule_id_idx" ON "rule_breaches"("rule_id");
