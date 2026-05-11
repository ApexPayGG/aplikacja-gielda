-- Add Alpaca broker credentials per user settings
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "alpacaApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "alpacaApiSecret" TEXT,
ADD COLUMN IF NOT EXISTS "alpacaMode" TEXT DEFAULT 'paper';

