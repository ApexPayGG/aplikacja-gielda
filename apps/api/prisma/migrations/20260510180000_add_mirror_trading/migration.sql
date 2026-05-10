-- Mirror Trading: trader opt-in and followers
CREATE TABLE "mirror_permissions" (
    "id" TEXT NOT NULL,
    "trader_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "revenue_share" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mirror_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mirror_permissions_trader_id_key" ON "mirror_permissions"("trader_id");

CREATE TABLE "mirror_followers" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "trader_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mirror_followers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mirror_followers_follower_id_trader_id_key" ON "mirror_followers"("follower_id", "trader_id");
CREATE INDEX "mirror_followers_follower_id_idx" ON "mirror_followers"("follower_id");
CREATE INDEX "mirror_followers_trader_id_idx" ON "mirror_followers"("trader_id");
