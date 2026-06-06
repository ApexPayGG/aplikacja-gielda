# Active Tasks

Operator queue for Cursor-first workflow. Update status and `next_action` when work moves; link blockers to `09_session_handoff.md`.

**Last updated:** May 2026 (initial queue after audit)

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
| **status** | `pending` |
| **owner** | operator (VPS Cursor or SSH) |
| **risk** | medium — drift causes false smoke results |
| **scope** | Production checkout on VPS: `git rev-parse HEAD`, `git log -1 --oneline`, compare to GitHub `main` and PA V2 commits in `06` |
| **blocked_by** | none |
| **next_action** | On VPS: run SHA commands from `03_deployment_runbook.md` drift section; record result in `09_session_handoff.md` |

---

## PA-V2-SMOKE.1 — ORCL cache / smoke

| Field | Value |
|-------|-------|
| **status** | `pending` |
| **owner** | operator (VPS) |
| **risk** | medium — unverified production behavior |
| **scope** | Two authenticated `GET /api/premium/ORCL/analysis` requests; logs for `premium_analysis_llm_normalized_contract` vs cache hit; see `06` QA checklist |
| **blocked_by** | `VPS-VERIFY.1` (know deployed commit before interpreting results) |
| **next_action** | After VPS SHA recorded: run smoke per `06_premium_analysis_v2_status.md`; update `04_known_issues.md` if new findings |

---

## PA-V2-2D — Cost governance / cache envelope / rate limit

| Field | Value |
|-------|-------|
| **status** | `ready_after_smoke` |
| **owner** | backend operator |
| **risk** | high — touches usage limits and cost controls |
| **scope** | `apps/api` premium analysis usage, cache TTL/envelope, rate limit behavior (no change until smoke confirms baseline) |
| **blocked_by** | `PA-V2-SMOKE.1` |
| **next_action** | Wait for ORCL smoke pass; then scope 2D diff against `06` and `07` |

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
