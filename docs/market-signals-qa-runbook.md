# MarketSignals QA Runbook (Steps 5.0–5.11)

Professional QA layer for MarketSignals before enabling `MARKET_SIGNALS_SCHEDULER_ENABLED=true`.

**Scope:** MarketSignals module only. Does not cover Autopilot, Alpaca, or general deploy pipelines.

**Production host:** `https://stock-ai.pro` (nginx → `stockai-api-prod` on port 3000).

---

## 1. Package scripts (inspected)

| App | Script | Command | MarketSignals relevance |
|-----|--------|---------|-------------------------|
| `apps/api` | `build` | `tsc --noEmit` | Type-check all API code including MarketSignals |
| `apps/api` | `test` | `node --import tsx/esm --test src/**/*.test.ts` | Full API suite (includes MarketSignals + unrelated modules) |
| `apps/api` | `lint` | `eslint src --ext .ts` | Optional pre-commit gate |
| `apps/frontend` | `build` | `tsc --noEmit && vite build` | Validates MarketSignals UI types and production bundle |

There is **no dedicated `test:market-signals` npm script** yet. Use the scoped `node --test` invocations below.

---

## 2. Test matrix

### 2.1 Backend unit tests (offline, no secrets, no live providers)

| Area | Test file | What it proves |
|------|-----------|----------------|
| Adapters | `marketSignals.adapters.test.ts` | Provider payload → normalized signal mapping |
| Ingestion | `marketSignals.ingestion.test.ts` | Parse/validate ingest input; provider-ingest route guard |
| Queue | `marketSignals.queue.test.ts` | BullMQ enqueue, worker handler, provider-enqueue route |
| Fetchers | `marketSignals.fetchers.test.ts` | Ticker normalization, fetch-enqueue route, live fetch mocked |
| Scheduler | `marketSignals.scheduler.test.ts` | Config parsing, disabled-by-default, batch enqueue logic |
| Ops health | `marketSignals.ops.test.ts` | Health payload shape, warnings, ops/health route + guard |
| Provider check | `marketSignals.providerCheck.test.ts` | Polygon reference 200 + trades/options 403 = not entitled |
| Service | `marketSignals.service.test.ts` | List/ingest business rules, lookback clamp |
| Admin/internal guard | `requireAdminOrInternal.test.ts` | Read vs write route authorization matrix |

**Expected Polygon provider-check semantics (unit-tested, mock fetch):**

- `referenceTicker` → HTTP 200, `ok: true`
- `tradesEndpoint` → HTTP 403, `entitled: false`
- `optionsSnapshotEndpoint` → HTTP 403, `entitled: false`
- `usableForMarketSignals: false` until trades endpoint returns 200 (plan upgrade)

### 2.2 Frontend build (offline)

| Check | Command | Pass criteria |
|-------|---------|---------------|
| TypeScript | `tsc --noEmit` (via `npm run build`) | Zero TS errors in MarketSignals components |
| Vite production bundle | `vite build` (via `npm run build`) | Build completes; no unresolved imports |

MarketSignals UI files: `apps/frontend/src/components/market-signals/*`, wired from `CompanyDetail.tsx`.

### 2.3 Production smoke tests (live API, requires JWT)

All MarketSignals routes sit under `/api/v1/market-signals` and require `Authorization: Bearer <JWT>` except where noted.

| # | Endpoint | Auth | Expected |
|---|----------|------|----------|
| S1 | `GET /api/v1/market-signals/ops/health` | None | **401** `{ "error": "Unauthorized" }` |
| S2 | `GET /api/v1/market-signals/ops/health` | JWT (normal user) | **403** `ADMIN_OR_INTERNAL_REQUIRED` |
| S3 | `GET /api/v1/market-signals/ops/health` | JWT + `x-internal-api-key: $INTERNAL_API_KEY` | **200**, JSON with `ok`, `scheduler`, `queue`, `database`, `warnings` |
| S4 | `GET /api/v1/market-signals/ops/provider-check?provider=POLYGON&ticker=AAPL` | JWT + internal key | **200**; `referenceTicker.httpStatus === 200`; trades/options **403** and `entitled: false` on current Polygon tier |
| S5 | `GET /api/v1/market-signals/AAPL` | Normal user JWT | **200**; body has `ticker`, `signals`, `summary` |
| S6 | `POST /api/v1/market-signals/ingest` | Normal user JWT | **403** |
| S7 | `POST /api/v1/market-signals/provider-ingest` | Normal user JWT | **403** |
| S8 | `POST /api/v1/market-signals/provider-enqueue` | Normal user JWT | **403** |
| S9 | `POST /api/v1/market-signals/provider-fetch-enqueue` | Normal user JWT | **403** |

**Write endpoints (S6–S9)** must never return 2xx for a non-admin JWT without internal key.

---

## 3. When to run each gate

| Gate | Before commit | Before deploy | After deploy | Manual only |
|------|:-------------:|:-------------:|:------------:|:-----------:|
| Backend MarketSignals unit tests (§2.1) | **✓** (recommended) | **✓** | — | — |
| API `tsc --noEmit` (`apps/api` build) | Optional | **✓** | — | — |
| Frontend `npm run build` | Optional | **✓** | — | — |
| ESLint (`apps/api`) | Optional | — | — | — |
| Production smoke S1–S9 (§2.3) | — | Optional (staging/canary) | **✓** | **✓** |
| Live provider-check against Polygon (S4) | — | — | **✓** | **✓** |
| Scheduler enablement verification | — | — | **✓** | **✓** |
| Full API test suite (`npm test` all files) | — | **✓** (via `deploy.yml`) | — | — |

**Scheduler rule:** Do **not** set `MARKET_SIGNALS_SCHEDULER_ENABLED=true` until S1–S9 pass on production and ops health shows acceptable queue/database state.

---

## 4. Commands

### 4.1 Windows PowerShell (local dev)

From repo root:

```powershell
# Backend — MarketSignals unit tests only
Set-Location "apps\api"
npm ci
node --import tsx/esm --test `
  src/modules/market-signals/marketSignals.adapters.test.ts `
  src/modules/market-signals/marketSignals.ingestion.test.ts `
  src/modules/market-signals/marketSignals.queue.test.ts `
  src/modules/market-signals/marketSignals.fetchers.test.ts `
  src/modules/market-signals/marketSignals.scheduler.test.ts `
  src/modules/market-signals/marketSignals.ops.test.ts `
  src/modules/market-signals/marketSignals.providerCheck.test.ts `
  src/modules/market-signals/marketSignals.service.test.ts `
  src/middleware/requireAdminOrInternal.test.ts

# Backend — typecheck
npm run build

# Frontend — TypeScript + Vite build
Set-Location "..\frontend"
npm ci
npm run build

Set-Location "..\.."
```

**Production smoke (PowerShell)** — set tokens first:

```powershell
$BaseUrl = "https://stock-ai.pro"
$UserJwt = "<paste normal-user JWT>"
$InternalKey = "<paste INTERNAL_API_KEY from VPS .env.production>"

# S1 — 401 without JWT
Invoke-WebRequest -Uri "$BaseUrl/api/v1/market-signals/ops/health" -SkipHttpErrorCheck |
  Select-Object StatusCode

# S2 — 403 with JWT only
Invoke-WebRequest -Uri "$BaseUrl/api/v1/market-signals/ops/health" `
  -Headers @{ Authorization = "Bearer $UserJwt" } -SkipHttpErrorCheck |
  Select-Object StatusCode

# S3 — 200 with JWT + internal key
Invoke-RestMethod -Uri "$BaseUrl/api/v1/market-signals/ops/health" `
  -Headers @{ Authorization = "Bearer $UserJwt"; "x-internal-api-key" = $InternalKey }

# S4 — provider-check POLYGON
Invoke-RestMethod -Uri "$BaseUrl/api/v1/market-signals/ops/provider-check?provider=POLYGON&ticker=AAPL" `
  -Headers @{ Authorization = "Bearer $UserJwt"; "x-internal-api-key" = $InternalKey }

# S5 — read for normal user
Invoke-RestMethod -Uri "$BaseUrl/api/v1/market-signals/AAPL" `
  -Headers @{ Authorization = "Bearer $UserJwt" }

# S6 — write blocked
Invoke-WebRequest -Method POST -Uri "$BaseUrl/api/v1/market-signals/ingest" `
  -Headers @{ Authorization = "Bearer $UserJwt"; "Content-Type" = "application/json" } `
  -Body '{"ticker":"AAPL","signalType":"DARK_POOL","source":"manual","confidenceScore":0.8}' `
  -SkipHttpErrorCheck | Select-Object StatusCode
```

### 4.2 VPS SSH (production / canary)

```bash
cd /root/aplikacja-gielda

# Confirm scheduler still disabled
grep MARKET_SIGNALS_SCHEDULER .env.production || echo "MARKET_SIGNALS_SCHEDULER_ENABLED not set (defaults disabled)"

# Ops health via localhost (bypass nginx SSL)
source .env.production
USER_JWT="<normal-user-jwt>"

# S1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/market-signals/ops/health

# S2
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer ${USER_JWT}" \
  http://localhost:3000/api/v1/market-signals/ops/health

# S3
curl -s -H "Authorization: Bearer ${USER_JWT}" \
  -H "x-internal-api-key: ${INTERNAL_API_KEY}" \
  http://localhost:3000/api/v1/market-signals/ops/health | jq .

# S4 — live Polygon entitlement probe (uses production POLYGON_API_KEY)
curl -s -H "Authorization: Bearer ${USER_JWT}" \
  -H "x-internal-api-key: ${INTERNAL_API_KEY}" \
  "http://localhost:3000/api/v1/market-signals/ops/provider-check?provider=POLYGON&ticker=AAPL" | jq .

# S5
curl -s -H "Authorization: Bearer ${USER_JWT}" \
  http://localhost:3000/api/v1/market-signals/AAPL | jq .

# S6 — expect 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer ${USER_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","signalType":"DARK_POOL","source":"manual","confidenceScore":0.8}' \
  http://localhost:3000/api/v1/market-signals/ingest

# Queue snapshot (optional)
docker exec stockai-api-prod node -e "
  import('bullmq').then(async ({ Queue }) => {
    const q = new Queue('market-signals-ingestion-queue', { connection: process.env.REDIS_URL });
    console.log(await q.getJobCounts('waiting','active','delayed','completed','failed'));
    await q.close();
  });
"
```

---

## 5. CI proposal

See `.github/workflows/market-signals-ci.yml`.

That workflow is **non-deploying**: install → typecheck → MarketSignals unit tests → frontend build. No secrets, no live provider calls, no DB migrations.

Existing `deploy.yml` on `push` to `main` already runs the **full** API test suite before Docker build/deploy. The MarketSignals workflow adds a **fast, path-scoped** check on PRs touching MarketSignals files.

---

## 6. Rollback checklist

Use if a MarketSignals deploy causes regressions or scheduler was enabled prematurely.

### 6.1 Immediate containment

- [ ] Set `MARKET_SIGNALS_SCHEDULER_ENABLED=false` in `/root/aplikacja-gielda/.env.production`
- [ ] Restart API only: `docker compose -f docker-compose.prod.yml restart api` (or full stack if worker shares scheduler process)
- [ ] Confirm ops health: `scheduler.enabled === false`

### 6.2 API image rollback (matches `deploy.yml` pattern)

```bash
cd /root/aplikacja-gielda
PREV_IMAGE_ID="$(docker inspect --format='{{.Image}}' stockai-api-prod 2>/dev/null || true)"
# If you tagged rollback earlier:
export STOCKAI_IMAGE=stockai-api-prod:rollback
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
curl -fsS http://localhost:3000/health
```

If no rollback tag exists, retag the previous image ID:

```bash
docker tag "${PREV_IMAGE_ID}" stockai-api-prod:rollback
export STOCKAI_IMAGE=stockai-api-prod:rollback
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

### 6.3 Queue hygiene (optional, manual)

- [ ] Inspect failed jobs: ops health `queue.failed` or Redis/BullMQ UI
- [ ] Do **not** flush Redis in production unless approved — affects unrelated queues
- [ ] Pause draining: leave failed jobs for post-mortem unless disk/Redis pressure requires cleanup

### 6.4 Verification after rollback

- [ ] S1–S5 smoke tests pass
- [ ] S6–S9 still return 403 for normal JWT
- [ ] Frontend company detail page loads MarketSignals panel without console errors
- [ ] No new failed jobs accumulating in `market-signals-ingestion-queue`

### 6.5 Communication

- [ ] Note rollback time, image SHA/tag, and failing smoke test ID in incident log
- [ ] Keep scheduler disabled until root cause fixed and QA matrix re-run

---

## 7. Sign-off template

| Check | Date | Operator | Result |
|-------|------|----------|--------|
| Backend unit tests (§2.1) | | | |
| Frontend build | | | |
| Smoke S1–S9 | | | |
| Provider-check POLYGON entitlement documented | | | |
| Scheduler remains disabled | | | |

**Approved to enable scheduler:** ☐ Yes ☐ No — Signature: _______________
