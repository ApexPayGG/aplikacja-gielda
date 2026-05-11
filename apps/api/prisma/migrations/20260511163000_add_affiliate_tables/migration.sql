-- Affiliate Broker Integration (Phase 1): core tables

CREATE TABLE IF NOT EXISTS "affiliate_brokers" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(50) NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "logo_url" VARCHAR(255),
  "partner_id" VARCHAR(100) NOT NULL,
  "affiliate_program_url" VARCHAR(255),
  "base_url" VARCHAR(500) NOT NULL,
  "ticker_url_template" VARCHAR(500),
  "click_id_param" VARCHAR(50) NOT NULL DEFAULT 'cid',
  "attribution_method" VARCHAR(20) NOT NULL,
  "supported_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "supported_markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "primary_language" VARCHAR(5),
  "commission_model" VARCHAR(20) NOT NULL,
  "commission_cpa_amount" DECIMAL(10,2),
  "commission_revshare_pct" DECIMAL(5,2),
  "commission_currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "conversion_tracking" VARCHAR(50),
  "api_endpoint" VARCHAR(255),
  "webhook_secret" VARCHAR(100),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "legal_disclaimer" JSONB,
  "risk_warning" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "affiliate_brokers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_brokers_slug_key" ON "affiliate_brokers"("slug");

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
  "id" TEXT NOT NULL,
  "click_id" VARCHAR(50) NOT NULL,
  "user_id" TEXT,
  "broker_id" TEXT NOT NULL,
  "source_page" VARCHAR(100),
  "source_ticker" VARCHAR(20),
  "source_signal_id" TEXT,
  "context_data" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "country_code" VARCHAR(2),
  "language" VARCHAR(5),
  "device_type" VARCHAR(20),
  "utm_source" VARCHAR(100),
  "utm_medium" VARCHAR(100),
  "utm_campaign" VARCHAR(100),
  "redirect_url" TEXT NOT NULL,
  "clicked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_clicks_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "affiliate_brokers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_clicks_click_id_key" ON "affiliate_clicks"("click_id");
CREATE INDEX IF NOT EXISTS "idx_affiliate_clicks_user" ON "affiliate_clicks"("user_id");
CREATE INDEX IF NOT EXISTS "idx_affiliate_clicks_broker" ON "affiliate_clicks"("broker_id");
CREATE INDEX IF NOT EXISTS "idx_affiliate_clicks_clicked_at" ON "affiliate_clicks"("clicked_at");
CREATE INDEX IF NOT EXISTS "idx_affiliate_clicks_source_ticker" ON "affiliate_clicks"("source_ticker");

CREATE TABLE IF NOT EXISTS "affiliate_conversions" (
  "id" TEXT NOT NULL,
  "click_id_ref" VARCHAR(50),
  "broker_id" TEXT NOT NULL,
  "user_id" TEXT,
  "external_user_id" VARCHAR(100),
  "conversion_type" VARCHAR(50) NOT NULL,
  "conversion_status" VARCHAR(20) NOT NULL,
  "commission_amount" DECIMAL(10,2),
  "commission_currency" VARCHAR(3),
  "ftd_amount" DECIMAL(12,2),
  "attribution_window_days" INTEGER,
  "matched_click_id" TEXT,
  "conversion_date" DATE NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paid_at" TIMESTAMPTZ,
  "raw_broker_data" JSONB,
  CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_conversions_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "affiliate_brokers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "affiliate_conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "affiliate_conversions_click_id_ref_fkey" FOREIGN KEY ("click_id_ref") REFERENCES "affiliate_clicks"("click_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "affiliate_conversions_matched_click_id_fkey" FOREIGN KEY ("matched_click_id") REFERENCES "affiliate_clicks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_affiliate_conversions_broker_date" ON "affiliate_conversions"("broker_id", "conversion_date");
CREATE INDEX IF NOT EXISTS "idx_affiliate_conversions_status" ON "affiliate_conversions"("conversion_status");

CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
  "id" TEXT NOT NULL,
  "broker_id" TEXT NOT NULL,
  "payout_period_start" DATE NOT NULL,
  "payout_period_end" DATE NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3),
  "conversion_count" INTEGER,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMPTZ,
  "reference_number" VARCHAR(100),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_payouts_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "affiliate_brokers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
