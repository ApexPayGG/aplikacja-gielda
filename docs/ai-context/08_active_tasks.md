# Active Tasks

Operator queue for Cursor-first workflow. Update status and `next_action` when work moves; link blockers to `09_session_handoff.md`.

**Last updated:** 2026-06-08 (PA-V2-2D Commit 2 deploy + smoke documented)

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
| **status** | `in_progress` |
| **owner** | backend operator |
| **risk** | high — touches usage limits and cost controls |
| **scope** | `apps/api` premium analysis usage, cache TTL/envelope, rate limit behavior |
| **blocked_by** | none (Commit 2 complete; Commit 3 not started) |
| **next_action** | PA-V2-2D Commit 3 — frontend analytics / optional `usage` typing. Do **not** enable PA V2 globally without explicit approval. Track ORCL `probabilityPct` as I-002. |

**Sync:** Local, GitHub `main`, and VPS are synchronized at `fead6995` (`api: add premium analysis quota visibility`).

| Commit | Status | Notes |
|--------|--------|-------|
| **Commit 1** (`9f0d3069`) | **DEPLOYED** + **SMOKE_TESTED** | Cache envelope / provider provenance |
| **Commit 2** (`fead6995`) | **DEPLOYED** + **SMOKE_TESTED** | Quota visibility, governance tests, cache-served log, response headers (API-only) |

**Commit 2 cache-hit governance smoke (ORCL V2, browser):** HTTP 200; `X-Premium-Analysis-Cache: hit`; daily usage headers **absent**; JSON `cacheStatus=hit`, `provider.name=fallback`, no `usage`. Logs: `premium_analysis_cache_served`, `symbol=ORCL`, `providerName=fallback`, `sourceCacheStatus=fallback`.

**PA V2 global rollout:** OFF — not approved; feature flag remains default OFF.

---

## GA-SMOKE.1 — Confirm `/g/collect`

| Field | Value |
|-------|-------|
| **status** | `pending` |
| **owner** | operator (browser + VPS logs if needed) |
| **risk** | low |
| **scope** | Verify Google Analytics / gtag collect endpoint behavior on production frontend |
| **blocked_by** | none |
| **next_action** | Network tab on `stock-ai.pro`; confirm `/g/collect` requests; note in handoff |

---

## STRIPE-LIVE.1 — EUR Price IDs / webhook smoke

| Field | Value |
|-------|-------|
| **status** | `blocked` |
| **owner** | operator (owner sign-off) |
| **risk** | high — billing and live money |
| **scope** | Stripe live EUR price IDs, webhook delivery, trial/checkout path |
| **blocked_by** | owner approval; live keys and price ID verification on VPS |
| **next_action** | Do not change Stripe config until explicitly requested; document blockers in `09` |

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
