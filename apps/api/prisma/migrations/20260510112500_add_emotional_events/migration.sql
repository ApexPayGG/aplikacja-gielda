-- CreateTable
CREATE TABLE "emotional_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "click_rate" DOUBLE PRECISION NOT NULL,
    "trade_frequency" DOUBLE PRECISION NOT NULL,
    "avg_decision_time" DOUBLE PRECISION NOT NULL,
    "stress_detected" BOOLEAN NOT NULL,
    "suggestion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotional_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emotional_events_user_id_created_at_idx" ON "emotional_events"("user_id", "created_at");
