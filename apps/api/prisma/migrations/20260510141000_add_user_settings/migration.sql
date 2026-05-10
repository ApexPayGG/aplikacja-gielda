CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordWebhook" TEXT,
    "mentorMode" BOOLEAN NOT NULL DEFAULT false,
    "digestEmail" TEXT,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");
