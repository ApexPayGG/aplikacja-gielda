ALTER TABLE "daily_check_ins"
ADD COLUMN IF NOT EXISTS "ai_message" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "daily_check_ins_user_id_created_day_key"
ON "daily_check_ins"("user_id", DATE("created_at"));
