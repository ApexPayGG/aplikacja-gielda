# Production Launch Smoke Checklist

Repeatable post-deploy verification for **stock-ai.pro**. Use after every production release that touches billing, auth, premium gating, affiliate, analytics, MarketSignals, or nginx.

**Related docs (do not duplicate - follow these for depth):**

| Topic | Document |
|-------|----------|
| Private beta Basic Auth (nginx) | [PRIVATE_BETA_ACCESS.md](./PRIVATE_BETA_ACCESS.md) |
| MarketSignals ops / scheduler | [market-signals-ops-runbook.md](./market-signals-ops-runbook.md) |
| MarketSignals QA matrix | [market-signals-qa-runbook.md](./market-signals-qa-runbook.md) |
| Premium institutional evidence (future UI) | [market-signals-premium-integration-spec.md](./market-signals-premium-integration-spec.md) |
| Affiliate staging QA | [qa/affiliate-staging-checklist.md](./qa/affiliate-staging-checklist.md) |
| Production env template | [../.env.production.example](../.env.production.example) |
| EUR pricing model (PRICING.1) | [PRICING_EUR_MIGRATION.md](./PRICING_EUR_MIGRATION.md) |

**Production host:** `https://stock-ai.pro`  
**VPS deploy dir (typical):** `/root/aplikacja-gielda`  
**Env file on VPS:** `.env.production` (never commit)

---

## 0. Known operational notes

- **`GET /api/affiliate/brokers` may return `brokers: []`** when no brokers have `is_active=true` in Postgres. This is expected until ops activates brokers.
- **eToro CTA** uses tracked `POST /api/affiliate/click` only when `etoro` is active in DB; otherwise it falls back to hardcoded med.etoro.com URLs (disclosure still shown). For production click tracking, activate eToro - see [section 7 Affiliate/admin smoke](#7-affiliateadmin-smoke).
- **Private beta:** most public HTTPS routes require HTTP Basic Auth. Prefer **internal Docker checks** (`docker exec ... curl http://api:3000/...`) for API smoke, or pass `-u 'beta-user:password'` for edge checks. Exceptions: `/health`, `/api/health`, `/api/stripe/webhook` (see [PRIVATE_BETA_ACCESS.md](./PRIVATE_BETA_ACCESS.md)).

---

## 1. Pre-deploy local gates

Run on your dev machine before merging or before VPS pull:

```bash
# Working tree clean (or only intentional launch files)
git status

# API
cd apps/api
npm.cmd run build
npm.cmd test -- src/routes/__tests__/stripe.test.ts
npm.cmd test -- src/routes/__tests__/adminAffiliate.test.ts
npm.cmd test -- src/services/__tests__/userAccessState.test.ts
npm.cmd test -- src/middleware/__tests__/requireActiveAccess.test.ts

# Frontend
cd ../frontend
npm.cmd run build
```

**Pass criteria:** builds exit 0; scoped tests pass. No `.env.production` or real secrets in `git status`.

---

## 2. VPS deploy sequence

SSH to production host:

```bash
cd /root/aplikacja-gielda

git fetch origin main
git pull --ff-only origin main
git log --oneline -3

# Full stack (nginx + frontend + api) when using docker-compose.prod.yml:
docker compose --env-file .env.production -f docker-compose.prod.yml build api frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate api frontend nginx

# API-only image deploy (CI/CD may use stockai-api-prod + docker-compose.yml):
# docker pull stockai-api-prod:latest
# docker compose --env-file .env.production up -d --force-recreate stockai-pro
```

**If `nginx-prod.conf` changed:**

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Verify `.env.production` on VPS includes required vars from `.env.production.example` (JWT, Stripe, ENCRYPTION_SECRET, etc.). GitHub Actions deploy may **not** write all keys - complete manually on VPS.

---

## 3. Core health

```bash
# API logs - expect HTTP listening, redis ready, workers started
docker logs stockai-api-prod --tail=120 2>&1 | grep -Ei 'listen|redis|market_signals|autopilot|error'

# Frontend container
docker logs stockai-frontend-prod --tail=50

# Internal nginx -> frontend HTML (no Basic Auth inside Docker network)
docker exec stockai-nginx-prod wget -qO- http://frontend:80/ | head -20

# Public health (no beta auth)
curl -fsS https://stock-ai.pro/health
curl -fsS https://stock-ai.pro/api/health
```

**Pass criteria:** `/health` returns 200; frontend HTML contains `<div id="root">` or app shell; no crash loop in API logs.

**Pricing (PRICING.3):** EUR checkout uses `STRIPE_PRICE_*_EUR` env keys only (no legacy USD fallback). Frontend checkout is **off by default** (`VITE_EUR_CHECKOUT_ENABLED=false`). Before enabling:

1. Create EUR recurring Prices in Stripe Dashboard.
2. Set all four Pro/Pro+ EUR Price ID env vars on API.
3. Verify `POST /api/stripe/create-checkout-session` returns `503 EUR_CHECKOUT_NOT_CONFIGURED` when env is missing.
4. Set `VITE_EUR_CHECKOUT_ENABLED=true` only after smoke checkout in test mode.
5. Grep built frontend/locales: no `$9/mo`, `$19/mo`, Early Adopter.

Trial Expired Mode enforcement (PRICING.4): verify `GET /api/auth/me/access` and premium/AI 403 when trial expired.

```bash
# After migration 20260525120000_add_user_trial_access_fields
docker exec stockai-api-prod wget -qO- --header="Authorization: Bearer $TOKEN" http://api:3000/api/auth/me/access
# Expired trial user on premium route -> 403 {"error":"TRIAL_EXPIRED","upgradeRequired":true}
```

**Polygon live quotes (`fetch-quotes` repeat job):** On API restart, the BullMQ repeat job is registered **only** when `POLYGON_LIVE_QUOTES_ENABLED=true` **and** `POLYGON_API_KEY` is set. With the default `POLYGON_LIVE_QUOTES_ENABLED=false`, logs should show:

`[scheduler] Polygon live quotes: disabled (POLYGON_LIVE_QUOTES_ENABLED is not true)`

Do **not** enable until Polygon entitlement is confirmed (e.g. provider-check). After deploy, verify the repeat job is **absent** unless explicitly enabled:

```bash
grep POLYGON_LIVE_QUOTES_ENABLED /root/aplikacja-gielda/.env.production
docker logs stockai-api-prod --tail=200 2>&1 | grep -i 'polygon live quotes'
# Optional: inspect BullMQ repeat jobs in Redis (fetch-quotes queue) - should be empty when disabled
```

Manual one-shot ingest (`npm run job:fetch-quotes` / GitHub polygon-live-ingest workflow) remains available when `POLYGON_API_KEY` is set; it does not require `POLYGON_LIVE_QUOTES_ENABLED`.

---

## 4. Stripe smoke

Use **internal API** (bypasses beta auth) or localhost on VPS:

```bash
# Fake webhook signature -> must be 400, NOT 401 (Basic Auth must not block webhook)
docker exec stockai-api-prod curl -sS -o /tmp/stripe-wh.json -w "%{http_code}" \
  -X POST http://127.0.0.1:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=0,v1=fake" \
  -d '{}'
cat /tmp/stripe-wh.json
# Expected HTTP code: 400

# Checkout without JWT -> 401
docker exec stockai-api-prod curl -sS -o /tmp/co-noauth.json -w "%{http_code}" \
  -X POST http://127.0.0.1:3000/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","billing":"monthly","userId":"any"}'
# Expected: 401

# Checkout with JWT but mismatched userId -> 403
# (Replace TOKEN and USER_ID with a real test user JWT)
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  -X POST http://127.0.0.1:3000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","billing":"monthly","userId":"someone-else"}'
# Expected: 403

# Checkout with own JWT -> 200 + Stripe URL in body
# Expected: {"url":"https://checkout.stripe.com/..."}

# Subscription for another user -> 403
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/stripe/subscription/OTHER_USER_ID \
  -H "Authorization: Bearer TOKEN"
# Expected: 403
```

**After a real test payment:** Stripe Dashboard -> Developers -> Webhooks -> delivery log must show `checkout.session.completed` (and related events) with **2xx** response.

---

## 5. Auth / user smoke

```bash
# Register test user (internal)
docker exec stockai-api-prod curl -sS -X POST http://127.0.0.1:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"launch-smoke+REPLACE@example.com","password":"SmokeTest!234"}'

# Verify email flag in DB (on VPS, adjust container name)
docker exec stockai-timescaledb-prod psql -U postgres -d stockai \
  -c "SELECT email, email_verified FROM users WHERE email LIKE 'launch-smoke%' ORDER BY created_at DESC LIMIT 1;"

# Login -> token present
docker exec stockai-api-prod curl -sS -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"launch-smoke+REPLACE@example.com","password":"SmokeTest!234"}'
# Expected: JSON with token string length > 20

# Delete test user when done (section 11)
```

---

## 6. Premium gating smoke

Manual browser check (with beta credentials if site is gated):

1. Log in as **FREE** user -> open `/company/AAPL/premium` -> only **screen 1** unlocked; screens 2-5 show upgrade overlay.
2. **PRO** user (admin tier override or real Stripe test checkout) -> screens **1-4** unlocked; screen 5 locked.
3. **PRO+** user -> all **5** screens unlocked.
4. Complete Stripe test checkout -> land on `/payment-success` -> UI refreshes tier from `/auth/me` (not URL `?plan=`). Network tab: `GET /api/auth/me` after load.

Tier badge in Premium header must reflect auth state, not `localStorage.userTier`.

---

## 7. Affiliate / admin smoke

```bash
# Public brokers list (no auth) - may be empty until brokers activated
docker exec stockai-api-prod curl -sS http://127.0.0.1:3000/api/affiliate/brokers
# Expected: 200, {"brokers":[...],"defaultBroker":...}

# Admin affiliate - no JWT -> 401
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/admin/affiliate/brokers
# Expected: 401

# Ordinary USER JWT -> 403
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/admin/affiliate/brokers \
  -H "Authorization: Bearer USER_JWT"
# Expected: 403

# ADMIN JWT -> 200
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/admin/affiliate/brokers \
  -H "Authorization: Bearer ADMIN_JWT"
# Expected: 200
```

**eToro production activation (when click tracking required):**

```bash
# Check seed/DB state
docker exec stockai-timescaledb-prod psql -U postgres -d stockai \
  -c "SELECT slug, is_active FROM affiliate_brokers WHERE slug='etoro';"

# Activate (ADMIN JWT + internal API):
docker exec stockai-api-prod curl -sS -X PATCH \
  http://127.0.0.1:3000/api/admin/affiliate/brokers/etoro \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"isActive":true}'

# Confirm public list includes etoro
docker exec stockai-api-prod curl -sS http://127.0.0.1:3000/api/affiliate/brokers | grep etoro
```

Browser: eToro CTA shows **affiliate disclosure + CFD warning** before button ([LAUNCH.5](../apps/frontend/src/components/EtoroCTAButton.tsx)).

---

## 8. GA4 / cookie smoke

Browser DevTools (incognito recommended):

1. Load `https://stock-ai.pro` -> **View Page Source** (or fetch `index.html` from frontend container):
   - Must **NOT** contain `googletagmanager.com`, `gtag/js`, or `G-XE45H4W6BW`.
2. Before accepting cookies -> Network tab -> no requests to `google-analytics.com` / `googletagmanager.com`.
3. Click **Accept all** on cookie banner -> GA script injected (`gtag/js?id=G-...`) -> `page_view` events on navigation.
4. Clear site data -> choose **Necessary only** -> no GA script; navigate -> still no GA requests.

Payment success: after consent, completing checkout fires `payment_success` (not `purchase`) with plan from auth tier - no revenue amount.

---

## 9. MarketSignals smoke

```bash
# Ops health - unauthenticated -> 401 or 403 (depends on guard)
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/v1/market-signals/ops/health

# With ADMIN JWT or x-internal-api-key -> 200
docker exec stockai-api-prod curl -sS \
  http://127.0.0.1:3000/api/v1/market-signals/ops/health \
  -H "Authorization: Bearer ADMIN_JWT"

# Provider check (live entitlement probes)
docker exec stockai-api-prod curl -sS \
  "http://127.0.0.1:3000/api/v1/market-signals/ops/provider-check?provider=EODHD" \
  -H "Authorization: Bearer ADMIN_JWT"

docker exec stockai-api-prod curl -sS \
  "http://127.0.0.1:3000/api/v1/market-signals/ops/provider-check?provider=POLYGON" \
  -H "Authorization: Bearer ADMIN_JWT"

# Scheduler must stay disabled unless canary signed off
grep MARKET_SIGNALS_SCHEDULER_ENABLED /root/aplikacja-gielda/.env.production
# Expected: false or unset

# Polygon live quotes repeat job (fetch-quotes) - separate flag; keep false unless entitlement confirmed
grep POLYGON_LIVE_QUOTES_ENABLED /root/aplikacja-gielda/.env.production
# Expected: false or unset (see §3 Core health)

# Institutional evidence - no JWT -> 401
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/v1/company/AAPL/institutional-evidence

# With user JWT -> 200 (may return empty evidence array)
docker exec stockai-api-prod curl -sS -w "\n%{http_code}" \
  http://127.0.0.1:3000/api/v1/company/AAPL/institutional-evidence \
  -H "Authorization: Bearer USER_JWT"
```

Follow [market-signals-ops-runbook.md](./market-signals-ops-runbook.md) before enabling `MARKET_SIGNALS_SCHEDULER_ENABLED=true`.

---

## 10. Autopilot smoke

```bash
# Worker started in API logs
docker logs stockai-api-prod --tail=200 2>&1 | grep -i autopilot

# ENCRYPTION_SECRET must be set (64 hex) - API fails autopilot crypto without it
grep ENCRYPTION_SECRET /root/aplikacja-gielda/.env.production
# Value must match /^[0-9a-fA-F]{64}$/ - do not paste value in tickets
```

**Beta policy:** paper trading only; live trading disabled / not marketed unless explicit sign-off.

---

## 11. Cleanup

- [ ] Delete launch smoke test users from DB.
- [ ] Cancel or note Stripe test subscriptions/customers in Dashboard (test mode vs live mode as appropriate).
- [ ] Revert temporary broker `is_active` flags if smoke-only.
- [ ] Local machine: `git status` clean (no accidental `.env` commits).

---

## Quick pass / fail summary

| Area | Pass |
|------|------|
| Pre-deploy builds + scoped tests | ☐ |
| VPS deploy + health endpoints | ☐ |
| Stripe webhook 400 not 401 | ☐ |
| Checkout/subscription ownership | ☐ |
| Premium tier gating + payment-success refresh | ☐ |
| Affiliate admin 401/403/200 | ☐ |
| eToro disclosure visible; etoro active if tracking required | ☐ |
| GA4 consent-gated | ☐ |
| MarketSignals ops + scheduler off | ☐ |
| Autopilot ENCRYPTION_SECRET + worker | ☐ |
| Cleanup complete | ☐ |
