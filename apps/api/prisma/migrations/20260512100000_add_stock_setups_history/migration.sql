-- Włącz pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela snapshotów setupów spółek
CREATE TABLE stock_setups_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  snapshot_date DATE NOT NULL,

  -- OHLCV features
  price_close DECIMAL(12,4),
  price_change_5d DECIMAL(8,4),
  price_change_20d DECIMAL(8,4),
  volume_ratio DECIMAL(8,4),  -- vs 20d avg
  rsi_14 DECIMAL(6,2),

  -- Outcome (wypełniany retroaktywnie)
  outcome_5d DECIMAL(8,4),
  outcome_20d DECIMAL(8,4),
  outcome_60d DECIMAL(8,4),

  -- Embedding numeryczny (9 features OHLCV)
  embedding vector(9),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, snapshot_date)
);

CREATE INDEX idx_setups_symbol ON stock_setups_history(symbol);
CREATE INDEX idx_setups_date ON stock_setups_history(snapshot_date);
CREATE INDEX idx_setups_embedding ON stock_setups_history
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
