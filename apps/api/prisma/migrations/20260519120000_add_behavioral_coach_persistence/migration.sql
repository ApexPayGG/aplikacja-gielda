-- CreateTable
CREATE TABLE "emotion_journal_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "ticker" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psyche_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fomo_score" INTEGER NOT NULL DEFAULT 50,
    "discipline" INTEGER NOT NULL DEFAULT 50,
    "greed_control" INTEGER NOT NULL DEFAULT 50,
    "patience" INTEGER NOT NULL DEFAULT 50,
    "growth_score" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psyche_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emotion_journal_entries_user_id_created_at_idx" ON "emotion_journal_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "psyche_snapshots_user_id_created_at_idx" ON "psyche_snapshots"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "emotion_journal_entries" ADD CONSTRAINT "emotion_journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psyche_snapshots" ADD CONSTRAINT "psyche_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
