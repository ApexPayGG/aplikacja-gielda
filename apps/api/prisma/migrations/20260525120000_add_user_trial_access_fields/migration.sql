-- PRICING.4: trial lifecycle fields for access enforcement
ALTER TABLE "users"
ADD COLUMN "trial_started_at" TIMESTAMP(3),
ADD COLUMN "trial_ends_at" TIMESTAMP(3),
ADD COLUMN "trial_kind" TEXT,
ADD COLUMN "access_state" TEXT;

-- Backfill existing users: 7-day no-card trial from account creation
UPDATE "users"
SET
  "trial_started_at" = COALESCE("trial_started_at", "created_at"),
  "trial_ends_at" = COALESCE("trial_ends_at", "created_at" + INTERVAL '7 days'),
  "trial_kind" = COALESCE("trial_kind", 'without_card'),
  "access_state" = CASE
    WHEN LOWER(COALESCE("subscription_status", 'free')) = 'active' THEN 'SUBSCRIPTION_ACTIVE'
    WHEN LOWER(COALESCE("subscription_status", 'free')) = 'trialing' THEN 'SUBSCRIPTION_TRIALING'
    WHEN "created_at" + INTERVAL '7 days' > NOW() THEN 'TRIAL_ACTIVE'
    ELSE 'TRIAL_EXPIRED'
  END
WHERE "trial_started_at" IS NULL OR "access_state" IS NULL;
