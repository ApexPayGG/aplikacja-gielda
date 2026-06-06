# Architecture

Document based on visible repository structure. Where not confirmed in repo, marked **UNKNOWN - verify**.

---

## High-level diagram

```
Browser (stock-ai.pro)
    |
    v
nginx (docker-compose.prod.yml)
    |-- static SPA --> frontend container (Vite build)
    |-- /api/*     --> api container :3000 (Express)
                           |
            +--------------+--------------+
            |              |              |
      timescaledb      redis 7        external APIs
      (Prisma)         (cache,        (Anthropic, Polygon,
                        BullMQ,       Finnhub, Stripe, etc.)
                        rate limits,
                        single-flight)
```

---

## Frontend (`apps/frontend/`)

- **Framework:** React 18, Vite, TypeScript, TailwindCSS
- **Routing:** react-router-dom
- **i18n:** i18next (`public/locales/{lng}/common.json`)
- **API client:** `src/services/api.ts` (axios)
- **Premium Analysis:** legacy multi-screen flow + V2 (`PremiumCompanyAnalysisV2.tsx`) behind feature flag (`src/config/featureFlags.ts`)
- **PWA:** service worker present (`public/` assets) — can cache stale bundles; see known issues

---

## Backend (`apps/api/`)

- **Runtime:** Node 20, TypeScript, ESM (`tsx`)
- **HTTP:** Express (`src/server.ts`, `src/index.ts`)
- **ORM:** Prisma (`apps/api/prisma/`) against PostgreSQL/TimescaleDB
- **Jobs:** BullMQ workers and cron (`src/jobs/`, `src/scheduler.ts`)
- **Auth:** JWT middleware (`src/modules/auth/`)
- **Product access:** trial/subscription gates (`src/middleware/requireActiveAccess.ts`, `productAccessMiddleware.ts`)
- **Rate limiting:** global middleware (`src/middleware/rateLimiter.ts`) — trial-aware for `/api/premium/*`
- **Premium Analysis V2:**
  - Snapshot: `src/modules/premiumAnalysis/dataSnapshot.ts`
  - Contract (Zod): `premiumAnalysisContract.ts`
  - Normalizer: `premiumAnalysisCandidateNormalizer.ts`
  - Orchestrator: `premiumAnalysisOrchestrator.ts` (Anthropic, single-flight, repair guard)
  - Routes: `src/routes/premiumCompany.ts`
- **AI telemetry:** `src/services/aiCostTelemetry.ts`

---

## Data stores

| Store | Image / tool | Repo evidence |
|-------|----------------|---------------|
| TimescaleDB | `timescale/timescaledb:latest-pg15` | `docker-compose.prod.yml`, Prisma schema |
| Redis 7 | `redis:7-alpine` | `docker-compose.prod.yml`, `src/redis.ts`, cache keys in `config/redis.ts` |

Redis uses: JSON cache, rate limit counters, premium analysis bundle cache, single-flight locks, usage limits.

---

## LLM providers

- **Primary:** Anthropic Claude (premium analysis orchestrator, AI briefs, coach modules — grep `@anthropic-ai/sdk` in `apps/api`)
- **Models:** resolved in `premiumAnalysisModelTasks.ts` — **exact production model IDs: UNKNOWN - verify** env/deploy config
- **Output path:** raw JSON -> `parseJsonObject` -> `normalizePremiumAnalysisCandidate` -> `validatePremiumAnalysisContract` (Zod) -> cache or deterministic fallback

---

## External integrations (partial list from repo)

- Stripe (billing, webhooks)
- Polygon / Finnhub / Alpha Vantage / EODHD (market data — scrapers under `apps/api/src/scrapers/`)
- Telegram bot (`apps/api/src/telegram/`)
- Discord modules

Full provider matrix: **UNKNOWN - verify** ops docs and `.env.production` on VPS.

---

## Deployment topology

- **Production compose:** `docker-compose.prod.yml` at repo root
- **Services:** `timescaledb`, `redis`, `api`, `frontend`, `nginx`
- **CI:** `.github/workflows/deploy.yml` — **exact trigger/branch: verify workflow file before relying on automation**
- **Manual VPS deploy:** documented in `03_deployment_runbook.md`

---

## Security boundaries

- Secrets in `.env.production` only (not in git)
- `optionalAuth` attaches JWT without blocking; `requireProductAccessForApi` enforces product access on protected routes
- Rate limiter runs early; product access middleware runs later — order matters in `server.ts`
