# Session Handoff

Short restart document for new Cursor sessions. **Update this file after substantive work.**

---

## Git state (verify — do not trust without running commands)

| Field | Value |
|-------|-------|
| **current local branch** | `main` |
| **sync point (local / GitHub / VPS)** | `5eae8469` (`docs: record premium analysis cache envelope deploy`) — verify with `git rev-parse HEAD` and `git status` |
| **last deployed API feature** | `9f0d3069` (`api: add premium analysis cache envelope`) — Commit 1 |
| **uncommitted at audit time** | PA-V2-2D Commit 2 app changes may exist **only** in local working tree — **not** on `main`; clean checkouts at `5eae8469` do not include them |

---

## Last completed

- Cursor-first **audit** confirmed existing governance pack (`01`–`07`, four `.cursor/rules/*.mdc`, `.gitignore` for rules).
- **Operational layer added:** `00_index.md`, `08_active_tasks.md`, `09_session_handoff.md` (this file), minimal links in `01` and `project-operating-rules.mdc`.
- UTF-8 mojibake cleanup completed for docs/ai-context/01–07 and verified clean.
- **OPERATOR-OS.1** completed in the current governance commit (session handoff, active tasks, operational layer).
- VPS-VERIFY.1 completed: production checkout synced to 757f0b43, containers running, API health 200.
- PA-V2-SMOKE.1 completed: ORCL V2 UI opened, two /analysis requests returned stable cache hit; no premium/analysis API errors in logs.
- PA-V2-2D Commit 1 deployed and smoke tested: cache envelope/provenance live on API; ORCL fallback cached and served as cache hit with `provider=fallback`.
- Delivery audit (`11_delivery_audit.md`) created at `5eae8469` sync point.

---

## Current focus

PA-V2-2D Commit 2 — **uncommitted working-tree changes only** at audit time (if present on operator machine). Not committed, not deployed, not production-ready.

---

## Next operator step

1. Read `docs/ai-context/11_delivery_audit.md`.
2. On the operator machine: `git status` — review or **discard** any uncommitted Commit 2 app diff.
3. If kept after review: commit as a **separate app commit** (do not mix with docs-only commits expecting those app changes to exist).
4. Only then: API-only deploy + smoke. Commit 3 (analytics) follows. Do not enable V2 globally.

---

## Open blockers

| Blocker | Notes |
|---------|-------|
| `STRIPE-LIVE.1` | Blocked on owner + live Stripe verification |

---

## Do not forget

- Chat history is **not** source of truth — read `00_index.md` first.
- **Local Cursor** = code / build / test. **VPS Cursor** = deploy / logs / smoke.
- Commit only when operator explicitly asks.
- After backend changes: targeted tests + `apps/api` build (not required for docs-only tasks).
- `optionalAuth` must stay before rate limiter in `server.ts`.
- Do not weaken PA V2 normalizer, validation, single-flight, or usage limits without approval.
- Observed ORCL `dividend_scraper skip_no_company` is unrelated to PA V2 smoke; consider under Dividend Hub / data quality audit, not PA 2D.
- ORCL LLM validation failed on missing `scenarios.scenarios.*.probabilityPct`; track separately from cache envelope (see `04_known_issues.md` I-002).

---

## Copy-paste prompt for next Cursor session

```
Read docs/ai-context/00_index.md, then 11_delivery_audit.md, 09_session_handoff.md, 08_active_tasks.md.
Do not rely on chat history.

Verify: git rev-parse HEAD (expect 5eae8469 on main), git status (note any uncommitted Commit 2 app files).
Commit 1 is deployed/smoke tested. Commit 2 is NOT on main — review or discard local diff before any app commit.

No commit unless I ask. Local = coding/build/test; VPS = deploy/logs/smoke.
```
