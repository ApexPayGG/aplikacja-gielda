-- Market Events Intelligence (Event Risk Radar) — Etap 1

CREATE TABLE "market_events" (
    "id" TEXT NOT NULL,
    "symbol" TEXT,
    "exchange" TEXT,
    "event_type" TEXT NOT NULL,
    "event_subtype" TEXT,
    "event_date" DATE NOT NULL,
    "event_time" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "fiscal_period" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_events_dedupe_key_key" ON "market_events"("dedupe_key");
CREATE INDEX "market_events_symbol_event_date_idx" ON "market_events"("symbol", "event_date");
CREATE INDEX "market_events_event_date_importance_idx" ON "market_events"("event_date", "importance");
CREATE INDEX "market_events_event_type_event_date_idx" ON "market_events"("event_type", "event_date");

CREATE TABLE "event_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT,
    "watchlist_only" BOOLEAN NOT NULL DEFAULT true,
    "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
    "min_importance" TEXT NOT NULL DEFAULT 'medium',
    "days_before" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
    "webhook_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_subscriptions_user_id_is_active_idx" ON "event_subscriptions"("user_id", "is_active");

CREATE TABLE "event_deliveries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_deliveries_dedupe_key_key" ON "event_deliveries"("dedupe_key");
CREATE INDEX "event_deliveries_user_id_created_at_idx" ON "event_deliveries"("user_id", "created_at" DESC);
CREATE INDEX "event_deliveries_status_idx" ON "event_deliveries"("status");

ALTER TABLE "event_deliveries" ADD CONSTRAINT "event_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "market_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
