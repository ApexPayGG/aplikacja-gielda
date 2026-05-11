CREATE TABLE "stock_setups_history" (
  "id" TEXT NOT NULL,
  "ticker" VARCHAR(16) NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "pe" DOUBLE PRECISION,
  "pe_vs_sector" DOUBLE PRECISION,
  "pe_vs_history" DOUBLE PRECISION,
  "ps" DOUBLE PRECISION,
  "ev_ebitda" DOUBLE PRECISION,
  "revenue_growth_3y" DOUBLE PRECISION,
  "earnings_growth_3y" DOUBLE PRECISION,
  "growth_decelerating" BOOLEAN NOT NULL DEFAULT false,
  "net_debt_to_ebitda" DOUBLE PRECISION,
  "fcf_yield" DOUBLE PRECISION,
  "margin_trend_3y" TEXT,
  "market_cap_rank_in_sector" INTEGER,
  "market_share_trend" TEXT,
  "analyst_buy_pct" DOUBLE PRECISION,
  "retail_ownership_pct" DOUBLE PRECISION,
  "short_interest" DOUBLE PRECISION,
  "rate_environment" TEXT,
  "sector_momentum" DOUBLE PRECISION,
  "market_breadth" DOUBLE PRECISION,
  "outcome_5y_return" DOUBLE PRECISION,
  "outcome_max_drawdown" DOUBLE PRECISION,
  "outcome_volatility" DOUBLE PRECISION,
  "notable_events" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_setups_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_stock_setup_ticker_date"
  ON "stock_setups_history"("ticker", "snapshot_date");

CREATE INDEX "idx_stock_setup_ticker_date"
  ON "stock_setups_history"("ticker", "snapshot_date");

CREATE INDEX "idx_stock_setup_date"
  ON "stock_setups_history"("snapshot_date");
