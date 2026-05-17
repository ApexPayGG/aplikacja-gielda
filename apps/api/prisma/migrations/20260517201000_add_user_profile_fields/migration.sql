-- AlterTable
ALTER TABLE "users"
ADD COLUMN "language" TEXT DEFAULT 'pl',
ADD COLUMN "timezone" TEXT DEFAULT 'Europe/Warsaw',
ADD COLUMN "avatar_url" TEXT;
