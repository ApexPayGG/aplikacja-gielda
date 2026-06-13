# Session Handoff

Short restart document for new Cursor sessions. **Update this file after substantive work.**

---

## Git state (verify — do not trust without running commands)

| Field | Value |
|-------|-------|
| **current local branch** | `main` |
| **current repo HEAD** | verify with `git rev-parse HEAD` and `git log -1 --oneline` — may be a later docs-only commit after this handoff |
| **app deploy baseline** | API `fead6995` (Commit 2); frontend `be1a864d` (Commit 3) |
| **last deployed API feature** | `fead6995` — PA-V2-2D Commit 2 (quota visibility + cache-hit governance) |
| **last deployed frontend feature** | `be1a864d` — PA-V2-2D Commit 3 (V2 loaded analytics + `usage` typing) |
| **API deploy** | API at `fead6995`; container healthy; `/health` HTTP 200 |
| **Frontend deploy** | `be1a864d`; `stockai-frontend-prod` recreated; HTTPS smoke HTTP 200 |
| **Stripe LIVE checkout** | **operator-verified on production** — see STRIPE-LIVE.1 in `08`; code on `main`; documented 2026-06-13 |

---

## Last completed

- **Stripe post-payment smoke (2026-06-13; Pro monthly trial only):** `/pricing` → Pro monthly → Stripe Checkout LIVE → Revolut / 3DS → payment success page. Checkout: Pro, 14-day trial, €29/mo after trial, EUR 0.00 authorization. Success page: “Your Pro trial is active.”, trial ends Jun 27, 2026. `GET /api/auth/me/access` (200): `tier=PRO`, `subscriptionStatus=trialing`, `accessState=SUBSCRIPTION_TRIALING`, `trialKind=with_card`, `trialEndsAt=2026-06-27T15:08:21.000Z`, `canUseProduct=true`. Post-payment webhook/DB access upgrade **smoke-tested** for this path. **Customer Portal not implemented** — cancel active test trials in Stripe Dashboard unless retained. Pro+/yearly/refund/cancel flows **not** smoke-tested.
- PA-V2-2D **Commit 3** (`be1a864d`): frontend-only deployed and smoke tested — `premium_analysis_v2_view` + `premium_analysis_v2_loaded` in `dataLayer`; optional `usage` typing on `PremiumAnalysisBundle`.
- **Commit 3 ORCL V2 telemetry smoke (browser; `localStorage.stockai.premiumAnalysisV2=true`):**
  - `dataLayer`: `premium_analysis_v2_view`
  - `dataLayer`: `premium_analysis_v2_loaded` with `symbol=ORCL`, `language=en`, `cache_status=hit`, `provider_name=fallback`, `locale=en`
  - No usage params on cache hit: no `daily_limit`, `daily_remaining`, `daily_reset_in`, `usage_tier` (expected)
  - `/g/collect` not observed in Network — separate GA-SMOKE.1 / GTM delivery follow-up; not a Commit 3 failure
- **STRIPE-LIVE.1** — Checkout + post-payment access smoke-tested on production (2026-06-13). Code on `main` (`stripeEurPricing.ts`, `stripe.ts`, `acb5c037`). Hosted checkout verified earlier; **Pro monthly trial** end-to-end verified with access state upgrade. Do not recreate Dashboard Price IDs.
- PA-V2-2D **Commit 1** (`9f0d3069`): deployed and smoke tested — cache envelope / provider provenance.
- PA-V2-2D **Commit 2** (`fead6995`): committed, API-only deployed, smoke tested.
- **Commit 2 ORCL cache-hit governance smoke (browser, V2 UI):**
  - `GET /api/premium/ORCL/analysis` — HTTP 200
  - `X-Premium-Analysis-Cache: hit`
  - Daily usage headers **not** present on cache hit
  - JSON: `cacheStatus=hit`, `provider.name=fallback`, no `usage`
  - API logs: `premium_analysis_cache_served`, `symbol=ORCL`, `providerName=fallback`, `sourceCacheStatus=fallback`
- Delivery audit (`11_delivery_audit.md`) updated through Commit 3 deploy/smoke and Stripe post-payment smoke.

---

## Current focus

**I-002** — ORCL `probabilityPct` normalizer/prompt fix (recommended next per priority order). **GA-SMOKE.1** remains open (`/g/collect` / GTM delivery not verified). **Stripe Customer Portal** not implemented (monetization follow-up).

---

## Next operator step

1. Read `docs/ai-context/11_delivery_audit.md` and this file.
2. **Recommended next:** I-002 (`probabilityPct`) when approved.
3. **Parallel / follow-up:** GA-SMOKE.1 — confirm `/g/collect` on production (dataLayer events already verified for Commit 3).
4. Do **not** enable PA V2 globally without explicit operator approval.
5. I-003 (digest model) remains open — separate work.
6. **Stripe monetization follow-up:** implement Customer Portal (in-app cancel/billing) — not smoke-tested; active trials must be cancelled manually in Stripe Dashboard until then.

---

## Open blockers

| Blocker | Notes |
|---------|-------|
| *(none for Stripe checkout + post-payment access)* | STRIPE-LIVE.1 closed for Pro monthly trial smoke (2026-06-13); Customer Portal still missing |
| *(none for PA-V2-2D Commit 3)* | Commits 1–3 deployed + smoke tested |

---

## Do not forget

- Chat history is **not** source of truth — read `00_index.md` first.
- **Local Cursor** = code / build / test. **VPS Cursor** = deploy / logs / smoke.
- Commit only when operator explicitly asks.
- After backend changes: targeted tests + `apps/api` build (not required for docs-only tasks).
- `optionalAuth` must stay before rate limiter in `server.ts`.
- Do not weaken PA V2 normalizer, validation, single-flight, or usage limits without approval.
- **Stripe:** live checkout + post-payment access smoke-tested (Pro monthly trial, 2026-06-13); Customer Portal not implemented — cancel test trials in Stripe Dashboard unless retained.
- **PA V2 global rollout:** OFF / not approved.
- ORCL `probabilityPct` validation failures — I-002; not fixed by Commits 1–3.
- Daily digest model `claude-sonnet-4-20250514` not found — I-003.
- GA `/g/collect` delivery — **not verified** (GA-SMOKE.1 open); Commit 3 `dataLayer` telemetry **is** verified.

---

## Copy-paste prompt for next Cursor session

```
Read docs/ai-context/00_index.md, then 11_delivery_audit.md, 09_session_handoff.md, 08_active_tasks.md.
Do not rely on chat history.

Verify: git status and `git log -1 --oneline`. App deploy baselines: API fead6995, frontend be1a864d.
PA-V2-2D Commits 1–3 deployed and smoke tested (API fead6995; frontend be1a864d).
Commit 3: dataLayer premium_analysis_v2_loaded verified; cache hit omits usage params.
Stripe LIVE checkout + post-payment access smoke-tested (Pro monthly trial, 2026-06-13). Customer Portal not implemented.
Next recommended: I-002 probabilityPct. GA-SMOKE.1 open (/g/collect not observed). Do not enable V2 globally.

No commit unless I ask. Local = coding/build/test; VPS = deploy/logs/smoke.
```
