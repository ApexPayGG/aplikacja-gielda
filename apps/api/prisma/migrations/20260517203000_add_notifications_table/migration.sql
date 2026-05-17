CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_userId_read_idx"
  ON "notifications"("userId", "read");
