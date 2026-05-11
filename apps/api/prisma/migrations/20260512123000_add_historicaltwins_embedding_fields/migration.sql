CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE stock_setups_history
  ADD COLUMN IF NOT EXISTS price_close DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS price_change_5d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS price_change_20d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS volume_ratio DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rsi_14 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_5d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_20d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_60d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS embedding vector(9);

CREATE INDEX IF NOT EXISTS idx_setups_symbol ON stock_setups_history(symbol);
CREATE INDEX IF NOT EXISTS idx_setups_date ON stock_setups_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_setups_embedding
  ON stock_setups_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
