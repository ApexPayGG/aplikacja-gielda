CREATE TABLE "weekly_reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "answers" JSONB NOT NULL,
    "ai_letter" TEXT,
    "growth_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_reviews_user_id_week_start_key" ON "weekly_reviews"("user_id", "week_start");
CREATE INDEX "weekly_reviews_user_id_week_start_idx" ON "weekly_reviews"("user_id", "week_start" DESC);
