ALTER TABLE "users"
ADD COLUMN "stripe_customer_id" TEXT,
ADD COLUMN "subscription_status" TEXT DEFAULT 'free',
ADD COLUMN "subscription_end" TIMESTAMP(3);
