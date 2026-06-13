# Active Tasks

Operator queue for Cursor-first workflow. Update status and `next_action` when work moves; link blockers to `09_session_handoff.md`.

**Last updated:** 2026-06-13 (Stripe post-payment Pro monthly trial smoke documented)

---

## OPERATOR-OS.1 — Domknięcie handoff / task queue

| Field | Value |
|-------|-------|
| **status** | `done` |
| **owner** | operator + Cursor (docs) |
| **risk** | low |
| **scope** | `docs/ai-context/00_index.md`, `08_active_tasks.md`, `09_session_handoff.md`, minimal updates to `01` and `project-operating-rules.mdc` |
| **blocked_by** | none |
| **next_action** | Completed in current governance commit. Next: VPS-VERIFY.1. |

---

## VPS-VERIFY.1 — Sprawdzenie SHA produkcji

| Field | Value |
|-------|-------|
| **status** | `done` |
| **owner** | operator (VPS Cursor or SSH) |
| **risk** | medium — drift causes false smoke results |
| **scope** | Production checkout on VPS: `git rev-parse HEAD`, `git log -1 --oneline`, compare to GitHub `main` and PA V2 commits in `06` |
| **blocked_by** | none |
| **next_action** | Completed: VPS synced to 757f0b43; containers running; API health 200. Next: PA-V2-SMOKE.1. |

---

## PA-V2-SMOKE.1 — ORCL cache / smoke

| Field | Value |
|-------|-------|
| **status** | `done` |
| **owner** | operator (VPS) |
| **risk** | medium — unverified production behavior |
| **scope** | Two authenticated `GET /api/premium/ORCL/analysis` requests; logs for `premium_analysis_llm_normalized_contract` vs cache hit; see `06` QA checklist |
| **blocked_by** | none |
| **next_action** | Completed: ORCL V2 UI smoke passed with stable cache hit on two requests; no premium/analysis API errors in logs. Next: PA-V2-2D. |

---

## PA-V2-2D — Cost governance / cache envelope / rate limit

| Field | Value |
|-------|-------|
| **status** | `done` (Commits 1–3) |
| **owner** | backend + frontend operator |
| **risk** | high — touches usage limits and cost controls |
| **scope** | `apps/api` premium analysis usage, cache TTL/envelope, rate limit behavior; frontend PA V2 governance telemetry |
| **blocked_by** | none |
| **next_action** | Commits 1–3 complete. **Recommended next:** I-002 (`probabilityPct` normalizer/prompt). GA-SMOKE.1 (`/g/collect` / GTM delivery) remains open separately. Do **not** enable PA V2 globally without explicit approval. |

**App deploy baseline:** API `fead6995`, frontend `be1a864d` (`frontend: add PA V2 loaded analytics and usage typing`). Current repo HEAD may be a later docs-only commit — verify with `git rev-parse HEAD` and `git log -1 --oneline`.

| Commit | Status | Notes |
|--------|--------|-------|
| **Commit 1** (`9f0d3069`) | **DEPLOYED** + **SMOKE_TESTED** | Cache envelope / provider provenance |
| **Commit 2** (`fead6995`) | **DEPLOYED** + **SMOKE_TESTED** | Quota visibility, governance tests, cache-served log, response headers (API-only) |
| **Commit 3** (`be1a864d`) | **DEPLOYED** + **SMOKE_TESTED** | Frontend `premium_analysis_v2_view` + `premium_analysis_v2_loaded`; optional `usage` typing (frontend-only deploy) |

**Commit 2 cache-hit governance smoke (ORCL V2, browser):** HTTP 200; `X-Premium-Analysis-Cache: hit`; daily usage headers **absent**; JSON `cacheStatus=hit`, `provider.name=fallback`, no `usage`. Logs: `premium_analysis_cache_served`, `symbol=ORCL`, `providerName=fallback`, `sourceCacheStatus=fallback`.

**Commit 3 frontend telemetry smoke (ORCL V2, browser; V2 via `localStorage.stockai.premiumAnalysisV2=true`):** `dataLayer` contains `premium_analysis_v2_view` and `premium_analysis_v2_loaded`; loaded payload: `symbol=ORCL`, `language=en`, `cache_status=hit`, `provider_name=fallback`, `locale=en`; **no** `daily_limit`, `daily_remaining`, `daily_reset_in`, or `usage_tier` on cache hit (expected).

**PA V2 global rollout:** OFF — not approved; feature flag remains default OFF.

---

## GA-SMOKE.1 — Confirm `/g/collect` / GTM delivery

| Field | Value |
|-------|-------|
| **status** | `pending` |
| **owner** | operator (browser + VPS logs if needed) |
| **risk** | low |
| **scope** | Verify Google Analytics `/g/collect` (or GTM) network delivery on production frontend |
| **blocked_by** | none |
| **next_action** | Network tab on `stock-ai.pro`; confirm `/g/collect` requests. **Note:** Commit 3 `dataLayer` events (`premium_analysis_v2_loaded`) verified in browser — `/g/collect` not observed; treat as GTM delivery follow-up, not Commit 3 failure. |

---

## STRIPE-LIVE.1 — EUR live checkout activation

| Field | Value |
|-------|-------|
| **status** | `done` (checkout + post-payment access smoke) |
| **owner** | operator (VPS + browser) |
| **risk** | high — billing and live money |
| **scope** | Live EUR checkout on production; post-payment access upgrade for Pro monthly trial |
| **blocked_by** | none |
| **next_action** | Checkout and post-payment access smoke complete for **Pro monthly trial** (2026-06-13). **Monetization follow-up:** Stripe Customer Portal not implemented — users cannot self-cancel in-app; cancel active test trials manually in Stripe Dashboard unless intentionally retained. Do **not** recreate Price IDs or Stripe products. |

**Code on `main` (repo evidence):** EUR resolver (`stripeEurPricing.ts`), checkout session + webhook routes (`stripe.ts`, `stripeModule.ts`), frontend gate (`VITE_EUR_CHECKOUT_ENABLED`); commit `acb5c037` on `main`.

**Production checkout (operator-verified; documented 2026-06-13):**

- VPS `.env.production` (operator-reported): `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET`, all four `STRIPE_PRICE_*_EUR` — **SET**
- `/pricing` → **Get Pro** / **Get Pro+** → hosted **`checkout.stripe.com`** (StockAI Pro **€29/mo**, **14-day** card trial)

**Post-payment smoke-tested (2026-06-13; Pro monthly trial only):**

- Flow: `/pricing` → Pro monthly → Stripe Checkout LIVE → Revolut / 3DS → payment success page
- Checkout UI: StockAI Pro / Pro, 14-day trial, €29/month after trial; EUR 0.00 card authorization (Revolut)
- Payment success page: “Payment successful!”, “Your Pro trial is active.”, trial ends **Jun 27, 2026**
- `GET /api/auth/me/access` (200): `tier=PRO`, `subscriptionStatus=trialing`, `accessState=SUBSCRIPTION_TRIALING`, `trialKind=with_card`, `trialEndsAt=2026-06-27T15:08:21.000Z`, `canUseProduct=true`, `upgradeRequired=false`
- Closes highest billing risk for **Pro monthly trial start** (webhook/DB access upgrade verified via access state)

**Not smoke-tested:** Pro+ plans, yearly billing, refund flow, in-app cancellation (Customer Portal missing).

**Investor OS checkout** remains `501 INVESTOR_OS_CHECKOUT_NOT_SUPPORTED` — unchanged.

---

## INVESTOR-DIVIDEND-HUB.1 — Architecture audit

| Field | Value |
|-------|-------|
| **status** | `ready` |
| **owner** | Cursor + operator |
| **risk** | low (read-only audit) |
| **scope** | Dividend hub / investor features — architecture and data sources audit |
| **blocked_by** | none |
| **next_action** | Read-only pass on `apps/api` dividend modules and related docs; output findings to handoff or new issue rows in `04` |

---

## MARKET-DATA.1 — Provider coverage matrix

| Field | Value |
|-------|-------|
| **status** | `proposed` |
| **owner** | operator |
| **risk** | medium — data quality affects analysis |
| **scope** | Matrix of Polygon / Finnhub / Alpha Vantage / EODHD coverage vs snapshot fields (`02` UNKNOWNs) |
| **blocked_by** | none |
| **next_action** | Propose matrix structure in handoff; verify against scrapers and `.env.production` on VPS when approved |
