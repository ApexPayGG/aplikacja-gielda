-- CreateTable
CREATE TABLE IF NOT EXISTS "dlq_events" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "dlq_events_pkey" PRIMARY KEY ("id", "created_at")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dlq_events_created_at_idx" ON "dlq_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dlq_events_job_id_idx" ON "dlq_events"("job_id");

-- Optional: TimescaleDB hypertable (safe no-op when extension is unavailable)
DO $$
BEGIN
  PERFORM public.create_hypertable('dlq_events', 'created_at', if_not_exists => TRUE);
EXCEPTION
  WHEN undefined_function THEN
    NULL;
  WHEN invalid_schema_name THEN
    NULL;
END $$;
