CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE stock_setups_history
  ADD COLUMN IF NOT EXISTS symbol VARCHAR(20),
  ADD COLUMN IF NOT EXISTS snapshot_date DATE,
  ADD COLUMN IF NOT EXISTS price_close DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS price_change_5d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS price_change_20d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS volume_ratio DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS rsi_14 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_5d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_20d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS outcome_60d DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS embedding vector(9),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE stock_setups_history
SET symbol = ticker
WHERE symbol IS NULL AND ticker IS NOT NULL;

ALTER TABLE stock_setups_history
  ALTER COLUMN symbol SET NOT NULL,
  ALTER COLUMN snapshot_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_setups_symbol ON stock_setups_history(symbol);
CREATE INDEX IF NOT EXISTS idx_setups_date ON stock_setups_history(snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_setups_symbol_snapshot_unique
  ON stock_setups_history(symbol, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_setups_embedding
  ON stock_setups_history USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
