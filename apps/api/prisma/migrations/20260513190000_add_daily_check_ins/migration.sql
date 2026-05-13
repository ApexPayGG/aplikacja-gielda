CREATE TABLE "daily_check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "plan" TEXT,
    "risk_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daily_check_ins_user_id_created_at_idx" ON "daily_check_ins"("user_id", "created_at" DESC);

CREATE UNIQUE INDEX "daily_check_ins_user_id_created_day_key"
ON "daily_check_ins"("user_id", DATE("created_at"));
