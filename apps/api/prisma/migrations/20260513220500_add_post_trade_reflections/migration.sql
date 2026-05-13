CREATE TABLE "post_trade_reflections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "trade_id" TEXT NOT NULL,
  "followed_plan" BOOLEAN NOT NULL,
  "emotion" TEXT,
  "lesson" TEXT,
  "ai_insight" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_trade_reflections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_trade_reflections_trade_id_key" ON "post_trade_reflections"("trade_id");
