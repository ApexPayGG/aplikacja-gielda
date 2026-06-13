# Session Handoff

Short restart document for new Cursor sessions. **Update this file after substantive work.**

---

## Git state (verify — do not trust without running commands)

| Field | Value |
|-------|-------|
| **current local branch** | `main` |
| **sync point (local / GitHub / VPS)** | `fead6995` (`api: add premium analysis quota visibility`) — verify with `git rev-parse HEAD`; docs HEAD may be `e984db62`+ |
| **last deployed API feature** | `fead6995` — PA-V2-2D Commit 2 (quota visibility + cache-hit governance) |
| **API deploy** | API-only; container recreated; `/health` HTTP 200; VPS build passed |
| **Stripe LIVE checkout** | **operator-verified on production** — see STRIPE-LIVE.1 in `08`; code on `main`; documented 2026-06-13 |

---

## Last completed

- **STRIPE-LIVE.1 (checkout activation)** — Code on `main` (`stripeEurPricing.ts`, `stripe.ts`, `acb5c037`). Production: VPS env operator-reported SET (`sk_live_`, four `STRIPE_PRICE_*_EUR`, webhook secret); browser smoke `/pricing` → **Get Pro** → hosted **`checkout.stripe.com`** (Pro €29/mo, 14-day trial). Post-payment webhook + DB tier **not** fully smoke-tested. Do not recreate Dashboard Price IDs.
- PA-V2-2D **Commit 1** (`9f0d3069`): deployed and smoke tested — cache envelope / provider provenance.
- PA-V2-2D **Commit 2** (`fead6995`): committed, API-only deployed, smoke tested.
- **Commit 2 ORCL cache-hit governance smoke (browser, V2 UI):**
  - `GET /api/premium/ORCL/analysis` — HTTP 200
  - `X-Premium-Analysis-Cache: hit`
  - Daily usage headers **not** present on cache hit
  - JSON: `cacheStatus=hit`, `provider.name=fallback`, no `usage`
  - API logs: `premium_analysis_cache_served`, `symbol=ORCL`, `providerName=fallback`, `sourceCacheStatus=fallback`
- Delivery audit (`11_delivery_audit.md`) updated through Commit 2 deploy/smoke and Stripe LIVE checkout documentation.

---

## Current focus

**PA-V2-2D Commit 3** — frontend analytics and optional frontend typing for `usage` / quota visibility. **Status: NOT STARTED / TODO.**

---

## Next operator step

1. Read `docs/ai-context/11_delivery_audit.md` and this file.
2. Implement Commit 3 (frontend analytics) when approved.
3. Do **not** enable PA V2 globally without explicit operator approval.
4. I-002 (`probabilityPct`) and I-003 (digest model) remain open — separate from Commit 3 unless scoped.
5. **Optional Stripe follow-up:** one real test payment → confirm `checkout.session.completed` webhook 2xx + tier/subscription in DB (`GET /api/auth/me/access`).

---

## Open blockers

| Blocker | Notes |
|---------|-------|
| *(none for Stripe checkout activation)* | STRIPE-LIVE.1 closed for live checkout; post-payment webhook verification remains optional |

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
- ORCL `probabilityPct` validation failures — I-002; not fixed by Commit 2.
- Daily digest model `claude-sonnet-4-20250514` not found — I-003.

---

## Copy-paste prompt for next Cursor session

```
Read docs/ai-context/00_index.md, then 11_delivery_audit.md, 09_session_handoff.md, 08_active_tasks.md.
Do not rely on chat history.

Verify: git rev-parse HEAD, git status.
Stripe LIVE checkout: code on main; production /pricing -> checkout.stripe.com operator-verified; webhook post-payment not fully smoke-tested.
PA-V2-2D Commit 1 and Commit 2 are deployed and smoke tested on API.
Next: PA-V2-2D Commit 3 (frontend analytics, NOT STARTED). Do not enable V2 globally.

No commit unless I ask. Local = coding/build/test; VPS = deploy/logs/smoke.
```
