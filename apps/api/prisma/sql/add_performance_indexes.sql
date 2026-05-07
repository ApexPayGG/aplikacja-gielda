-- Performance indexes for StockAI Pro (PostgreSQL / TimescaleDB).
-- NOTE: In this schema `company_id` is represented by `symbol`,
-- `published_at` is represented by `timestamp`,
-- and `indicators` data is stored in `technical_indicators`.

CREATE INDEX IF NOT EXISTS idx_quotes_company_id_timestamp_desc
  ON quotes (symbol, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_news_company_id_published_at_desc
  ON news (symbol, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_indicators_company_id_date_desc
  ON technical_indicators (symbol, "timestamp" DESC);
