ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "discordWebhook" TEXT,
ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
ADD COLUMN IF NOT EXISTS "notifySignals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "notifyDividends" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "minSignalScore" INTEGER NOT NULL DEFAULT 70;

UPDATE "users" u
SET "discordWebhook" = s."discordWebhook"
FROM "user_settings" s
WHERE s."userId" = u."id"
  AND u."discordWebhook" IS NULL
  AND s."discordWebhook" IS NOT NULL;
