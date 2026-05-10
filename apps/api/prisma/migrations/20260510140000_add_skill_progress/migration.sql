CREATE TABLE "skill_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_progress_user_id_skill_id_key" ON "skill_progress"("user_id", "skill_id");
CREATE INDEX "skill_progress_user_id_unlocked_at_idx" ON "skill_progress"("user_id", "unlocked_at");
