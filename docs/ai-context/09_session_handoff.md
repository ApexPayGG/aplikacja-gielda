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

- PA-V2-2D **Commit 3** (`be1a864d`): frontend-only deployed and smoke tested — `premium_analysis_v2_view` + `premium_analysis_v2_loaded` in `dataLayer`; optional `usage` typing on `PremiumAnalysisBundle`.
- **Commit 3 ORCL V2 telemetry smoke (browser; `localStorage.stockai.premiumAnalysisV2=true`):**
  - `dataLayer`: `premium_analysis_v2_view`
  - `dataLayer`: `premium_analysis_v2_loaded` with `symbol=ORCL`, `language=en`, `cache_status=hit`, `provider_name=fallback`, `locale=en`
  - No usage params on cache hit: no `daily_limit`, `daily_remaining`, `daily_reset_in`, `usage_tier` (expected)
  - `/g/collect` not observed in Network — separate GA-SMOKE.1 / GTM delivery follow-up; not a Commit 3 failure
- **STRIPE-LIVE.1 (checkout activation)** — Code on `main` (`stripeEurPricing.ts`, `stripe.ts`, `acb5c037`). Production: VPS env operator-reported SET (`sk_live_`, four `STRIPE_PRICE_*_EUR`, webhook secret); browser smoke `/pricing` → **Get Pro** → hosted **`checkout.stripe.com`** (Pro €29/mo, 14-day trial). Post-payment webhook + DB tier **not** fully smoke-tested. Do not recreate Dashboard Price IDs.
- PA-V2-2D **Commit 1** (`9f0d3069`): deployed and smoke tested — cache envelope / provider provenance.
- PA-V2-2D **Commit 2** (`fead6995`): committed, API-only deployed, smoke tested.
- **Commit 2 ORCL cache-hit governance smoke (browser, V2 UI):**
  - `GET /api/premium/ORCL/analysis` — HTTP 200
  - `X-Premium-Analysis-Cache: hit`
  - Daily usage headers **not** present on cache hit
  - JSON: `cacheStatus=hit`, `provider.name=fallback`, no `usage`
  - API logs: `premium_analysis_cache_served`, `symbol=ORCL`, `providerName=fallback`, `sourceCacheStatus=fallback`
- Delivery audit (`11_delivery_audit.md`) updated through Commit 3 deploy/smoke.

---

## Current focus

**I-002** — ORCL `probabilityPct` normalizer/prompt fix (recommended next per priority order). **GA-SMOKE.1** remains open (`/g/collect` / GTM delivery not verified).

---

## Next operator step

1. Read `docs/ai-context/11_delivery_audit.md` and this file.
2. **Recommended next:** I-002 (`probabilityPct`) when approved.
3. **Parallel / follow-up:** GA-SMOKE.1 — confirm `/g/collect` on production (dataLayer events already verified for Commit 3).
4. Do **not** enable PA V2 globally without explicit operator approval.
5. I-003 (digest model) remains open — separate work.
6. **Optional Stripe follow-up:** one real test payment → confirm `checkout.session.completed` webhook 2xx + tier/subscription in DB (`GET /api/auth/me/access`).

---

## Open blockers

| Blocker | Notes |
|---------|-------|
| *(none for Stripe checkout activation)* | STRIPE-LIVE.1 closed for live checkout; post-payment webhook verification remains optional |
| *(none for PA-V2-2D Commit 3)* | Commits 1–3 deployed + smoke tested |

---

## Do not forget

- Chat history is **not** source of truth — read `00_index.md` first.
- **Local Cursor** = code / build / test. **VPS Cursor** = deploy / logs / smoke.
- Commit only when operator explicitly asks.
- After backend changes: targeted tests + `apps/api` build (not required for docs-only tasks).
- `optionalAuth` must stay before rate limiter in `server.ts`.
- Do not weaken PA V2 normalizer, validation, single-flight, or usage limits without approval.
- **Stripe:** live checkout operator-verified — do not duplicate Price ID setup without a regression.
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
Stripe LIVE checkout operator-verified; webhook post-payment not fully smoke-tested.
Next recommended: I-002 probabilityPct. GA-SMOKE.1 open (/g/collect not observed). Do not enable V2 globally.

No commit unless I ask. Local = coding/build/test; VPS = deploy/logs/smoke.
```
