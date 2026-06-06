# Deployment Runbook

**Target:** Production VPS running Docker Compose (`docker-compose.prod.yml`)
**Domain:** https://stock-ai.pro
**Branch:** `main` on GitHub origin

---

## Principles

1. Never deploy uncommitted local changes.
2. Keep **local repo**, **GitHub main**, and **VPS checkout** in sync (fast-forward only on VPS).
3. Backend-only API changes: rebuild and restart **api** only unless frontend/nginx also changed.
4. Always health-check and inspect logs after a production test.

---

## Pre-deploy (local)

```bash
# From repo root or apps/api as appropriate
cd apps/api
npm run build
node --import tsx/esm --test src/modules/premiumAnalysis/premiumAnalysisCandidateNormalizer.test.ts
# Add other targeted tests for the change scope

cd ../..
git status
git diff
```

Commit locally only when ready and explicitly requested.

```bash
git add <files>
git commit -m "api: <short imperative summary>"
git push origin main
```

---

## Deploy on VPS (standard backend API path)

SSH to VPS, `cd` to the production checkout of `aplikacja-gielda`.

```bash
git fetch origin main:refs/remotes/origin/main
git merge --ff-only origin/main

docker compose --env-file .env.production -f docker-compose.prod.yml build api
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
docker compose --env-file .env.production -f docker-compose.prod.yml ps

curl -sS -i http://127.0.0.1:3000/health | head -20
```

After a production functional test (e.g. premium analysis request):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs api --tail 200
```

Look for errors, rate-limit noise, `premium_analysis_llm_*` telemetry, and single-flight messages.

---

## Frontend deploy (only when frontend changed)

**Not part of the standard backend-only path.** When `apps/frontend/` changes:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d frontend nginx
```

See also `docs/production-launch-smoke-checklist.md`.

---

## Health check expectations

`GET /health` on API port 3000 should return JSON with `status: ok` (see `apps/api/src/server.ts`).

---

## Rollback caution

- Prefer **forward fix** on `main` plus fast-forward deploy.
- `git merge --ff-only` will **fail** if VPS has local commits — resolve drift before deploy.
- Do not force-push `main` without explicit owner approval.
- Rolling back Docker images without matching git SHA causes opaque drift — tag or note the deployed commit in deploy notes.

---

## Drift detection

| Symptom | Likely cause |
|---------|----------------|
| VPS behavior differs from local | Unpushed commits or VPS not merged |
| UI shows old premium flow | Frontend not rebuilt, or service worker cache |
| API logs missing new telemetry events | Old api image still running |

Verify deployed commit on VPS:

```bash
git rev-parse HEAD
git log -1 --oneline
```

---

## Do not change without explicit request

- `docker-compose.prod.yml` structure
- `.env.production` on VPS
- Prisma migrations in production
- nginx TLS config
- Stripe/auth/pricing configuration
