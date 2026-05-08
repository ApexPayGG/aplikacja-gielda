-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DividendAlertType" AS ENUM ('dividend_cut', 'dividend_growth', 'anomaly', 'sector_change');

-- CreateEnum
CREATE TYPE "DividendTrendDirection" AS ENUM ('up', 'down', 'stable');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PaperTradeDirection" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "PaperTradeStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExitAction" AS ENUM ('HOLD', 'EXIT_NOW', 'TIGHTEN_SL', 'SCALE_OUT');

-- CreateEnum
CREATE TYPE "ExitUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlphaWindowType" AS ENUM ('EARNINGS_CYCLE', 'SEASONAL', 'SECTOR_ROTATION', 'REGIME_SHIFT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "web_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,8) NOT NULL,
    "high" DECIMAL(18,8) NOT NULL,
    "low" DECIMAL(18,8) NOT NULL,
    "close" DECIMAL(18,8) NOT NULL,
    "volume" BIGINT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "live_quotes" (
    "id" BIGSERIAL NOT NULL,
    "ticker" VARCHAR(10) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "open" DECIMAL(10,2),
    "high" DECIMAL(10,2),
    "low" DECIMAL(10,2),
    "close" DECIMAL(10,2),
    "volume" BIGINT,
    "vwap" DECIMAL(10,2),
    "idempotency_key" VARCHAR(64) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sentiment" TEXT,
    "source" TEXT NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "technical_indicators" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "indicator" TEXT NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,

    CONSTRAINT "technical_indicators_pkey" PRIMARY KEY ("timestamp","id")
);

-- CreateTable
CREATE TABLE "fundamentals" (
    "id" BIGSERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(24,8) NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundamentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividends" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "ex_date" TIMESTAMP(3) NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dividend_yield" DOUBLE PRECISION,
    "frequency" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_histories" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "year" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "growth_yoy" DOUBLE PRECISION,
    "cagr_5y" DOUBLE PRECISION,
    "cagr_10y" DOUBLE PRECISION,

    CONSTRAINT "dividend_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_alerts" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "alert_type" "DividendAlertType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "metric" VARCHAR(64),
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividend_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_intelligence" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "safety_score" INTEGER NOT NULL,
    "safety_reason" TEXT NOT NULL,
    "trend_direction" "DividendTrendDirection" NOT NULL,
    "sector_percentile" INTEGER NOT NULL,
    "last_analyzed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dividend_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_sustainability_scores" (
    "id" TEXT NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "final_score" INTEGER NOT NULL,
    "payout_score" INTEGER NOT NULL,
    "coverage_score" INTEGER NOT NULL,
    "consistency_score" INTEGER NOT NULL,
    "payout_ratio" DOUBLE PRECISION,
    "fcf_coverage" DOUBLE PRECISION,
    "explanation" TEXT NOT NULL,
    "components_json" TEXT,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model_version" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "dividend_sustainability_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "technical_data" JSONB NOT NULL,
    "historical_count" INTEGER,
    "win_rate" DOUBLE PRECISION,
    "avg_return_10d" DOUBLE PRECISION,
    "max_drawdown" DOUBLE PRECISION,
    "brief_pl" TEXT,
    "brief_en" TEXT,
    "score" INTEGER,
    "scoring_reasoning" TEXT,
    "marketRegime" TEXT,
    "regimeConfidence" INTEGER,
    "narrativeHeadline" TEXT,
    "narrativeBody" TEXT,
    "narrativeRisk" TEXT,
    "narrativeConfidence" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "user_triggered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dlq_events" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dlq_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signal_id" TEXT,
    "notes" TEXT,
    "pnl_amount" DOUBLE PRECISION,
    "pnl_pct" DOUBLE PRECISION,

    CONSTRAINT "VirtualTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_value" DOUBLE PRECISION NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "holdings" JSONB NOT NULL,
    "pnl_daily" DOUBLE PRECISION NOT NULL,
    "pnl_total" DOUBLE PRECISION NOT NULL,
    "pnl_pct" DOUBLE PRECISION NOT NULL,
    "benchmark_wig" DOUBLE PRECISION,
    "benchmark_sp500" DOUBLE PRECISION,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "alpha_windows" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "type" "AlphaWindowType" NOT NULL,
    "probability_score" INTEGER NOT NULL,
    "historical_avg_return" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "ai_note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alpha_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_quotes_company_id_timestamp_desc" ON "quotes"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_symbol_timestamp_source_key" ON "quotes"("symbol", "timestamp", "source");

-- CreateIndex
CREATE UNIQUE INDEX "live_quotes_idempotency_key_key" ON "live_quotes"("idempotency_key");

-- CreateIndex
CREATE INDEX "live_quotes_ticker_idx" ON "live_quotes"("ticker");

-- CreateIndex
CREATE INDEX "live_quotes_created_at_idx" ON "live_quotes"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_news_company_id_published_at_desc" ON "news"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_indicators_company_id_date_desc" ON "technical_indicators"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "technical_indicators_symbol_timestamp_indicator_key" ON "technical_indicators"("symbol", "timestamp", "indicator");

-- CreateIndex
CREATE INDEX "fundamentals_symbol_idx" ON "fundamentals"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "fundamentals_symbol_metric_year_key" ON "fundamentals"("symbol", "metric", "year");

-- CreateIndex
CREATE INDEX "dividends_symbol_ex_date_idx" ON "dividends"("symbol", "ex_date");

-- CreateIndex
CREATE INDEX "dividends_symbol_pay_date_idx" ON "dividends"("symbol", "pay_date");

-- CreateIndex
CREATE INDEX "dividend_histories_symbol_year_idx" ON "dividend_histories"("symbol", "year");

-- CreateIndex
CREATE UNIQUE INDEX "dividend_histories_symbol_year_key" ON "dividend_histories"("symbol", "year");

-- CreateIndex
CREATE INDEX "dividend_alerts_symbol_created_at_idx" ON "dividend_alerts"("symbol", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dividend_intelligence_symbol_key" ON "dividend_intelligence"("symbol");

-- CreateIndex
CREATE INDEX "dividend_intelligence_symbol_idx" ON "dividend_intelligence"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "dividend_sustainability_scores_symbol_key" ON "dividend_sustainability_scores"("symbol");

-- CreateIndex
CREATE INDEX "dividend_sustainability_scores_symbol_last_calculated_at_idx" ON "dividend_sustainability_scores"("symbol", "last_calculated_at");

-- CreateIndex
CREATE INDEX "Signal_ticker_created_at_idx" ON "Signal"("ticker", "created_at");

-- CreateIndex
CREATE INDEX "Signal_exchange_created_at_idx" ON "Signal"("exchange", "created_at");

-- CreateIndex
CREATE INDEX "Signal_expires_at_idx" ON "Signal"("expires_at");

-- CreateIndex
CREATE INDEX "dlq_events_created_at_idx" ON "dlq_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "dlq_events_job_id_idx" ON "dlq_events"("job_id");

-- CreateIndex
CREATE INDEX "VirtualTrade_userId_executed_at_idx" ON "VirtualTrade"("userId", "executed_at");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_date_idx" ON "PortfolioSnapshot"("userId", "date");

-- CreateIndex
CREATE INDEX "paper_trades_user_id_status_entry_at_idx" ON "paper_trades"("user_id", "status", "entry_at");

-- CreateIndex
CREATE INDEX "paper_trades_user_id_exit_at_idx" ON "paper_trades"("user_id", "exit_at");

-- CreateIndex
CREATE INDEX "behavioral_snapshots_user_id_calculated_at_idx" ON "behavioral_snapshots"("user_id", "calculated_at");

-- CreateIndex
CREATE INDEX "exit_signals_trade_id_created_at_idx" ON "exit_signals"("trade_id", "created_at");

-- CreateIndex
CREATE INDEX "exit_signals_ticker_created_at_idx" ON "exit_signals"("ticker", "created_at");

-- CreateIndex
CREATE INDEX "alpha_windows_ticker_created_at_idx" ON "alpha_windows"("ticker", "created_at");

-- CreateIndex
CREATE INDEX "alpha_windows_type_probability_score_idx" ON "alpha_windows"("type", "probability_score");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_indicators" ADD CONSTRAINT "technical_indicators_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_histories" ADD CONSTRAINT "dividend_histories_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_alerts" ADD CONSTRAINT "dividend_alerts_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_intelligence" ADD CONSTRAINT "dividend_intelligence_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_sustainability_scores" ADD CONSTRAINT "dividend_sustainability_scores_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "companies"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTrade" ADD CONSTRAINT "VirtualTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

