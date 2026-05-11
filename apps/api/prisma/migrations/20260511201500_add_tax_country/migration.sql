-- Add tax residency country to user settings
ALTER TABLE "user_settings"
ADD COLUMN "taxCountry" TEXT DEFAULT 'PL';
