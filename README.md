# StockAI Pro

# Production Status

🚀 Production Ready
✅ HTTPS enabled (stock-ai.pro)
✅ CI/CD automated deployment
✅ SSH key configured

## Live data ingestion (Polygon → `live_quotes`)

End-to-end flow: GitHub Actions (`.github/workflows/polygon-live-ingest.yml`, every 5 minutes UTC) SSH into the Hetzner host and runs `docker exec stockai-pro node --import tsx/esm scripts/trigger-fetch-quotes.ts`, which enqueues BullMQ job `fetch-quotes`. The API process (`npm run start` / `src/index.ts`) runs a worker that calls Polygon, upserts rows into `live_quotes` (5-minute idempotency via `idempotency_key`), and pushes per-ticker failures to the `fetch-quotes-dlq` queue.

### Verify locally

1. Apply DB migration: from `apps/api`, run `npx prisma migrate deploy` (or `migrate dev`) so table `live_quotes` exists.
2. Set `POLYGON_API_KEY`, `DATABASE_URL`, and `REDIS_URL` in `apps/api/.env`.
3. Start Redis + Postgres (e.g. `docker compose` from repo root) and run the API: `npm run start` in `apps/api` (scheduler + HTTP in one process).
4. Enqueue one run: `npm run job:fetch-quotes`.
5. Check rows: `npx prisma studio` or SQL `SELECT * FROM live_quotes ORDER BY created_at DESC LIMIT 20;`
6. Check HTTP: `GET /api/quotes/latest?ticker=AAPL`, `GET /api/quotes/history?ticker=AAPL&limit=50`, `GET /api/quotes/top?limit=10`, `GET /api/quotes/ingest-status` (last job counters from Redis).
7. Optional: same summary as raw Redis key `live-ingest:last` (JSON, TTL 10 minutes).

### Timescale hypertable

The migration adds a BRIN index on `created_at`. Converting `live_quotes` to a Timescale hypertable is left as an optional DBA step: standard unique constraints must include the partition column, which would require a schema adjustment before `create_hypertable` (see commented SQL in the migration file).
