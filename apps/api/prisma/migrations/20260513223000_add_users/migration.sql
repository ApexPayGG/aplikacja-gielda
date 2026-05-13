-- Add auth fields to existing users table.
ALTER TABLE "users"
ADD COLUMN "email" TEXT,
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN "last_login_at" TIMESTAMP(3);

-- Backfill existing rows so non-null constraints can be applied safely.
UPDATE "users"
SET "email" = CONCAT("id", '@local.invalid')
WHERE "email" IS NULL;

UPDATE "users"
SET "password_hash" = '$2b$10$7EqJtq98hPqEX7fNZaFWo.O1H6fQGQ8wYJYcqRR3YKHyCuXhFMaW6'
WHERE "password_hash" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password_hash" SET NOT NULL;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
