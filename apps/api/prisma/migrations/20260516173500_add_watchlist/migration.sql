CREATE TABLE "watchlists" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "watchlists_userId_symbol_key" ON "watchlists"("userId", "symbol");
CREATE INDEX "watchlists_userId_idx" ON "watchlists"("userId");

ALTER TABLE "watchlists"
ADD CONSTRAINT "watchlists_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
