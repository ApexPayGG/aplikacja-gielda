# Delivery Audit - StockAI Pro

**Purpose:** Durable project memory for Cursor sessions. Chat threads are not source of truth.
**Audit date:** 2026-06-08 (initial); **last status update:** 2026-06-13 (Stripe LIVE checkout documented)
**Verified sync point:** `fead6995` (`api: add premium analysis quota visibility`) — local / GitHub / VPS synchronized after API-only deploy.
**Auditor scope:** Read-only inspection of repo docs, code, git history, and working tree. No application edits, no deploy, no commit.

**Note on missing doc paths:** `03_todo_lista.md`, `05_deployment.md`, and `06_testing.md` do not exist. Use `03_deployment_runbook.md`, `05_product_decisions.md`, and `06_premium_analysis_v2_status.md` instead.

---

## Verification snapshot (this audit)

| Check | Result |
|-------|--------|
| Local HEAD | `fead6995` |
| PA-V2-2D Commit 2 on `main` | **Yes** — `fead6995` (`api: add premium analysis quota visibility`) |
| PA-V2-2D Commit 2 in production | **DEPLOYED** + **SMOKE_TESTED** (API-only deploy; `/health` 200) |
| PA-V2-2D Commit 1 | **DEPLOYED** + **SMOKE_TESTED** — `9f0d3069` (cache envelope) |
| PA V2 globally enabled | **No** — not approved; frontend flag default OFF (`featureFlags.ts`, env `VITE_PREMIUM_ANALYSIS_V2_ENABLED`) |
| Stripe EUR live checkout | **DEPLOYED** + **SMOKE_TESTED** (checkout path) — code on `main`; operator-verified `/pricing` → `checkout.stripe.com`; VPS env operator-reported SET; post-payment webhook **not** fully smoke-tested |
| `.cursor/rules/` tracked | 4 files: `project-operating-rules.mdc`, `security-and-testing.mdc`, `deployment-safety.mdc`, `financial-domain-safety.mdc` |

---

## 1. Intended target product

**StockAI Pro** (`https://stock-ai.pro`) is an **international, EUR trial-first SaaS** for **educational investment research and decision-support** - not personalized investment advice.

**Core value proposition (from `STOCKAI_PRO_PROJECT_INSTRUCTIONS.md`, `docs/PRICING_EUR_MIGRATION.md`, legacy strategic briefs):**

- AI-assisted company research: AI Briefs, Premium Analysis, Signal DNA, behavioral coaching, portfolio tooling.
- **Trial-first access:** 7-day no-card trial -> limited Pro+ experience; optional 14-day with-card trial via Stripe -> paid conversion.
- **Paid tiers (EUR display):** Pro (EUR 29/mo), Pro+ (EUR 59/mo), Investor OS (EUR 99/mo - forward-looking).
- **Trial Expired Mode:** account persists; core product blocked until upgrade.
- **Educational framing:** disclaimers, schema-validated LLM output, conservative fallback, no fabricated analyst data (`07_financial_safety.md`).
- **Monorepo:** `apps/api` (Express/Prisma/BullMQ/Redis), `apps/frontend` (React/Vite SPA), Docker production on Hetzner VPS.

**Target product maturity:** Production-hosted platform with broad feature surface. **EUR Stripe live checkout** is **code-complete on `main`** and **operator-verified in production** (`/pricing` → hosted `checkout.stripe.com`; VPS live keys/Price IDs operator-reported SET). Post-payment webhook + DB tier update is **not fully smoke-tested**. Investor OS checkout remains paused.

---

## 2. What has already been implemented?

| Area | Status | Evidence |
|------|--------|----------|
| Monorepo + Docker prod stack | **DONE** | `docker-compose.prod.yml`, `apps/api`, `apps/frontend` |
| Auth (JWT), registration, email verify | **DONE** | `apps/api/src/modules/auth/`, frontend auth pages |
| Trial lifecycle + access resolver | **DONE** | PRICING.4 - `userAccessState.ts`, DB fields, `requireActiveAccess` |
| EUR pricing config (display + access matrix) | **DONE** | `apps/api/src/config/pricing.ts`, mirror in frontend |
| Stripe checkout (EUR) — code | **DONE** (on `main`) | `stripeEurPricing.ts`, `stripe.ts`, `checkout.ts`; commit `acb5c037`; unit/route tests |
| Stripe checkout — production path | **DEPLOYED** + **SMOKE_TESTED** (checkout) | Operator-verified `/pricing` → `checkout.stripe.com`; VPS env operator-reported SET (`sk_live_`, four `STRIPE_PRICE_*_EUR`) |
| Stripe webhooks + tier sync | **DONE** (code); **PARTIAL** (prod smoke) | `stripeModule.ts`, tests in `stripe.test.ts`; post-payment `checkout.session.completed` 2xx + DB tier **not** fully smoke-tested |
| Premium Analysis V2 backend pipeline | **DONE** | Orchestrator, contract, normalizer 2L-2O, usage limits, single-flight, repair budget, telemetry |
| Premium Analysis cache envelope v1 | **DONE** | `9f0d3069` — `PremiumAnalysisCacheEnvelope`, provider provenance |
| PA-V2-2D Commit 2 quota visibility + governance | **DONE** | `fead6995` — usage metadata on fresh miss, headers, `premium_analysis_cache_served` log, governance tests |
| Premium Analysis V2 UI | **DONE** (flagged) | `PremiumCompanyAnalysisV2.tsx`, lazy load, legacy fallback UI |
| Global `/api/premium/*` rate limiter (trial-aware) | **DONE** | `rateLimiter.ts`, `optionalAuth` order in `server.ts` |
| AI cost telemetry | **DONE** | `aiCostTelemetry.ts` on Anthropic calls |
| Dividend data hybrid sync | **DONE** | EODHD + Finnhub - `scrapers/dividends.ts`, `dividendDataService.ts`, BullMQ `dividend-sync` |
| Dividend Hub UI | **DONE** | `/dividend`, screener, intelligence, compound calculator routes |
| Dividend calendar service | **DONE** | `dividendCalendarService.ts`, routes in `dividends.ts`, tests |
| Growth screener + frequency filter | **DONE** | `dividendService.ts`, frontend Dividend Hub |
| Market Signals module | **DONE** (code) | `marketSignals.routes`, scheduler env-gated |
| Behavioral coach, psyche, digest jobs | **DONE** (code) | BullMQ workers in `scheduler.ts` |
| Landing v4 + i18n (9 locales) | **DONE** | `LandingPage.tsx`, `public/locales/` |
| Cursor operating system | **DONE** | `docs/ai-context/00-09`, `.cursor/rules/*.mdc` |
| CI deploy workflow | **DONE** (code) | `.github/workflows/deploy.yml` (workflow_dispatch) |

---

## 3. What has been implemented and deployed to production?

Operator confirms production at **`fead6995`** after API-only deploy. **Last deployed API feature:** PA-V2-2D Commit 2 (`fead6995`).

| Capability | Status | Notes |
|------------|--------|-------|
| Premium Analysis V2 infra (2A-2O) | **DEPLOYED** | Commits through `04a635f5` in history; VPS verified in OPERATOR-OS / VPS-VERIFY.1 |
| PA-V2-2D Commit 1 — cache envelope | **DEPLOYED** + **SMOKE_TESTED** | `9f0d3069`; ORCL: fallback cached, hit serves `provider=fallback` |
| PA-V2-2D Commit 2 — quota visibility | **DEPLOYED** + **SMOKE_TESTED** | `fead6995`; ORCL cache-hit governance smoke passed (see section 4) |
| Cursor governance docs layer | **DEPLOYED** | `00`–`11` on main |
| Private beta nginx / TLS stack | **DEPLOYED** | **UNKNOWN - verify** exact nginx/basic-auth config on VPS |
| EUR live Stripe checkout | **DEPLOYED** + **SMOKE_TESTED** (checkout path) | Code on `main`; operator-verified `/pricing` → `checkout.stripe.com` (€29/mo, 14-day trial); VPS env operator-reported SET |
| PA V2 UI globally on | **Not deployed / not approved** | Feature flag OFF by default; global rollout requires explicit operator approval |

---

## 4. What has been smoke tested?

| Test | Status | Result |
|------|--------|--------|
| VPS SHA + container health | **SMOKE_TESTED** | VPS-VERIFY.1 - synced, API `/health` 200 |
| ORCL Premium Analysis (two requests) | **SMOKE_TESTED** | PA-V2-SMOKE.1 - cache hit, no API errors |
| ORCL cache envelope / fallback provenance | **SMOKE_TESTED** | Post-Commit 1 - `cacheStatus=hit`, `provider=fallback` (not hardcoded anthropic) |
| Full production launch checklist | **PARTIAL** | `docs/production-launch-smoke-checklist.md` exists; not all sections confirmed in ai-context |
| EUR Stripe checkout live | **SMOKE_TESTED** (checkout path) | STRIPE-LIVE.1 closed for activation: operator-verified `/pricing` → hosted `checkout.stripe.com` (Pro monthly EUR); VPS env operator-reported SET |
| Stripe webhook after completed payment | **NOT FULLY SMOKE_TESTED** | Optional follow-up: `checkout.session.completed` 2xx + tier/subscription state in DB after real payment |
| GA `/g/collect` | **TODO** | Task GA-SMOKE.1 pending |
| Commit 2 cache-hit governance (ORCL V2) | **SMOKE_TESTED** | HTTP 200; `X-Premium-Analysis-Cache: hit`; daily usage headers absent; JSON `cacheStatus=hit`, `provider.name=fallback`, no `usage`; log `premium_analysis_cache_served` with `providerName=fallback`, `sourceCacheStatus=fallback` |
| Commit 2 fresh-miss usage visibility | **PARTIAL** | Not re-smoked on prod in this pass; covered by unit tests; optional follow-up smoke on cache-busting symbol |

---

## 5. What is partially implemented but not production-ready?

| Item | Status | Gap |
|------|--------|-----|
| **PA-V2-2D Commit 3** (frontend analytics) | **TODO** | Next recommended work; optional frontend `usage` typing deferred from Commit 2 |
| **Investor OS tier** | **PARTIAL** | Pricing/copy/waitlist only; checkout returns `INVESTOR_OS_CHECKOUT_NOT_SUPPORTED` |
| **Premium Analysis V2 UI rollout** | **PARTIAL** | Backend production-stable; UI behind `localStorage` / env flag |
| **ORCL / symbol quality (I-002)** | **PARTIAL** | `probabilityPct` validation failures -> fallback; normalizer does not fill this field today |
| **Daily digest (I-003)** | **PARTIAL** | `digestModule.ts` uses `claude-sonnet-4-20250514` - model not found in prod logs |
| **max_tokens truncation (O-001)** | **PARTIAL** | Parse failures before normalizer; prompt/token budget work not done |
| **Valid-but-weak contracts (O-002)** | **PARTIAL** | No quality gate post-Zod |
| **Data coverage (O-003)** | **PARTIAL** | Snapshot gaps -> conservative analysis / larger `missingData` |
| **Redis multi-instance behavior (R-005)** | **UNKNOWN - verify** | Documented fallback to in-memory per process |
| **Market Signals production scheduler** | **UNKNOWN - verify** | Env flags `MARKET_SIGNALS_*` - default caution in deploy.yml comments |

---

## 6. What still needs to be implemented?

Prioritized by active task queue and known gaps:

1. **PA-V2-2D Commit 3** — frontend analytics and optional `usage` typing (recommended next).
2. **I-002** — normalizer or prompt fix for `scenarios.scenarios.*.probabilityPct` (separate from 2D; still open).
3. **I-003** — align digest (and possibly other modules) to valid Anthropic model IDs (still open).
4. **O-001** — prompt compaction / `max_tokens` budget.
5. **GA-SMOKE.1** — production analytics verification.
6. **Optional Stripe follow-up:** verify `checkout.session.completed` webhook 2xx + tier/subscription DB update (checkout path already live; not part of STRIPE-LIVE.1 closure).
7. **INVESTOR-DIVIDEND-HUB.1** — read-only architecture audit (dividend data quality, `skip_no_company` cases).
8. **MARKET-DATA.1** — provider coverage matrix vs snapshot fields.
9. **Investor OS product** — tier in DB, checkout, feature gating (future).
10. **Optional:** quality gate for weak-but-valid contracts; PA V2 global UI rollout (not approved).

---

## 7. What must not be rebuilt (already exists)

Tag: **DO_NOT_REBUILD**

| System | Why |
|--------|-----|
| Premium Analysis V2 orchestrator + Zod contract | Months of commits 2A-2O + 2D Commits 1-2; production-proven path |
| Normalizer layers 2L-2O | Extensive tests; alias-only financial safety rules |
| Single-flight coalescing (`withSingleFlight`) | ADR-007; waiters must not double-charge |
| Daily usage limits + trial-aware global rate limiter | Financial safety; `optionalAuth` order is critical |
| Deterministic fallback contract | ADR-005; validated, no analyst fiction |
| Cache envelope v1 + provider provenance | Deployed `9f0d3069`; extend, do not replace with bare contract cache |
| Commit 2 quota visibility + cache-served telemetry | Deployed `fead6995`; extend in Commit 3, do not weaken cache-hit quota skip |
| Trial lifecycle (PRICING.4) + `getUserAccessState` | DB fields, middleware, frontend gates |
| EUR pricing config + Stripe EUR resolver + **live VPS env** | Deployed; **do not recreate** Dashboard Price IDs |
| Dividend hybrid pipeline (EODHD/Finnhub) + BullMQ sync | `DIVIDEND_DATA_SOURCES.md`, scheduler jobs |
| Dividend Hub / calendar / growth screener | Recent implementation - extend filters/UI, do not duplicate services |
| Cursor ai-context pack + rules | Operational memory; update, do not replace with ad-hoc chat |
| Docker Compose production topology | api, frontend, nginx, redis, timescaledb |
| Frontend routing shell + i18n bundle pattern | 40+ routes in `App.tsx`; match conventions |
| Legacy Premium Analysis UI | Keep as fallback behind V2 flag |

---

## 8. What is deprecated or intentionally paused?

| Item | Status | Notes |
|------|--------|-------|
| Classic full Free tier | **DEPRECATED** | Trial-first model (PRICING.1) |
| Legacy USD Stripe Price ID checkout path | **DEPRECATED** | Replaced by EUR resolver; old `STRIPE_PRO_*` IDs not used by new resolver |
| ChatGPT-thread coordination | **DEPRECATED** | Cursor + `docs/ai-context/` is primary ops workspace (ADR-001) |
| Premium Analysis V2 global enable | **Paused** | Explicit operator approval required |
| Investor OS checkout | **Paused** | `501 INVESTOR_OS_CHECKOUT_NOT_SUPPORTED` |
| Ad-hoc Stripe Dashboard / Price ID changes | **Paused** | Live checkout verified — change only on explicit request |
| Founding offers, EUR 19 single report, AI credits | **Paused** | Documented future only (`FUTURE_MONETIZATION` in pricing docs) |
| Enabling Premium Analysis V2 for all users without flag | **Paused** | Product decision |

---

## 9. Highest-risk areas

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Usage limits / billing / cost controls** | Critical | Never weaken `enforcePremiumAnalysisDailyLimit`, rate limiter order, single-flight, or cache-hit quota skip without approval (`07`, R-003, R-004) |
| **LLM output financial safety** | Critical | Zod + normalizer + fallback; no fabricated metrics (`07`, R-002) |
| **Stripe live checkout** | Medium | Checkout path operator-verified; code on `main`; post-payment webhook + DB tier not fully smoke-tested; never change keys/Price IDs without checkpoint |
| **Fresh-miss usage smoke gap** | Low | Commit 2 cache-hit governance smoke passed; fresh-miss `usage` + daily headers not re-verified on prod in this pass |
| **Cache hit mis-reporting provider** | High | Commit 1 fixed hardcoded anthropic; regression would break ops trust |
| **Service worker / stale frontend bundles** | Medium | R-001; hard refresh after frontend deploy |
| **max_tokens / parse failures** | Medium | O-001; drives fallback rate and cost |
| **Model ID drift across modules** | Medium | I-003; many modules hardcode `claude-sonnet-4-20250514` while PA uses `resolvePremiumAnalysisModel` |
| **Redis unavailable / multi-instance** | Medium | R-005 - **UNKNOWN - verify** production replica count |
| **Dividend data gaps** | Medium | `skip_no_company`, stale/missing status - affects Dividend Hub trust |
| **Private beta basic auth** | Low-Medium | Complicates external smoke; use internal Docker curl per runbook |

---

## 10. Recommended implementation order from here

```
1. PA-V2-2D Commit 3: frontend analytics + optional usage typing
2. I-002: probabilityPct normalizer/prompt (quality, still open)
3. I-003: digest model ID alignment (still open)
4. O-001: max_tokens / prompt compaction
5. GA-SMOKE.1
6. Optional: Stripe post-payment webhook 2xx + tier/subscription DB smoke
7. INVESTOR-DIVIDEND-HUB.1 + MARKET-DATA.1 (read-only audits)
8. Investor OS / PA V2 global rollout (not approved)
```

**Do not:** enable V2 globally, push/deploy without checkpoint, or weaken financial safety controls during 2D work.

---

## Area reference matrix

| Area | Taxonomy | Summary |
|------|----------|---------|
| **Pricing / trial / access** | DEPLOYED | Trial-first EUR config; PRICING.4 enforcement on premium routes |
| **Stripe / checkout** | DEPLOYED + SMOKE_TESTED (checkout) | Code on `main`; operator-verified `/pricing` → hosted checkout; VPS env operator-reported SET; webhook post-payment not fully smoke-tested |
| **Premium Analysis V2 backend** | DEPLOYED + SMOKE_TESTED | Full pipeline + cache envelope + quota visibility on prod |
| **PA-V2-2D Commit 2** | DEPLOYED + SMOKE_TESTED | `fead6995`; cache-hit governance smoke passed (ORCL) |
| **PA-V2-2D Commit 3** | TODO | Frontend analytics — recommended next |
| **AI governance (cache/fallback/cost)** | DEPLOYED + SMOKE_TESTED | Envelope, provenance, cache-served log, cache-hit skips usage headers/metadata |
| **Frontend pages / routing** | DEPLOYED | Broad SPA; PA V2 UI flag OFF by default |
| **Backend API / usage limits** | DEPLOYED | Daily + monthly limits; trial-aware |
| **Investor OS** | PARTIAL / Paused | Pricing copy only; no checkout |
| **Dividend Hub** | DEPLOYED | Hub, screener, calendar, intelligence, compound |
| **Dividend data quality** | PARTIAL | Hybrid sync live; gaps (I-002 unrelated, `skip_no_company` noted in handoff) |
| **Company / snapshot data** | PARTIAL | O-003 coverage gaps |
| **Infrastructure (VPS/Docker)** | DEPLOYED | Compose prod stack; manual + GHA deploy paths |
| **Cursor OS (rules/docs/handoff)** | DEPLOYED | 00-09 + rules; **this file adds 11** |
| **Known issues I-002, I-003** | Investigating | Track in `04`; out of scope for audit fix |

---

## Unclear areas (UNKNOWN - verify)

| Topic | Action for operator |
|-------|---------------------|
| Exact VPS `.env.production` Stripe EUR Price IDs | **Operator-reported SET** (`sk_live_`, four Price IDs); do not recreate |
| Whether production frontend has V2 flag enabled for any cohort | Browser localStorage / env on VPS build |
| Anthropic model IDs configured in production `ANTHROPIC_*` env | VPS env audit |
| Multi-instance API replicas vs single container | `docker compose ps` on VPS |
| Full `production-launch-smoke-checklist.md` last run date | Operator log |
| GitHub Actions vs manual deploy - which path last used for `9f0d3069` | VPS deploy notes / image tags |
| Market Signals scheduler enabled in prod | `MARKET_SIGNALS_SCHEDULER_ENABLED` on VPS |
| Resend email domain verification status | Launch checklist section 0 |

---

## Related files (audit sources)

- `docs/ai-context/00_index.md` ... `09_session_handoff.md`
- `docs/ai-context/04_known_issues.md`
- `docs/ai-context/06_premium_analysis_v2_status.md`
- `docs/PRICING_EUR_MIGRATION.md`
- `docs/production-launch-smoke-checklist.md`
- `STOCKAI_PRO_PROJECT_INSTRUCTIONS.md`
- `git log --oneline -25` (verified 2026-06-08)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial delivery audit created (read-only verification at `5eae8469`). |
| 2026-06-08 | Safety pass: Commit 2 documented as uncommitted working-tree only. |
| 2026-06-08 | Post-deploy update: Commit 2 (`fead6995`) **DEPLOYED** + **SMOKE_TESTED**; cache-hit governance smoke recorded. |
| 2026-06-13 | Stripe LIVE checkout documented: code on `main`; operator-verified `/pricing` → `checkout.stripe.com`; VPS env operator-reported SET; STRIPE-LIVE.1 closed for checkout activation only; post-payment webhook not fully smoke-tested. |
