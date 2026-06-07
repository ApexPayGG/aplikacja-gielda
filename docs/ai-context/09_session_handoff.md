# Session Handoff

Short restart document for new Cursor sessions. **Update this file after substantive work.**

---

## Git state (verify — do not trust without running commands)

| Field | Value |
|-------|-------|
| **current local branch** | `main` |
| **current local commit** | `verify with git log -1 --oneline` - do not hardcode self-referential SHA |
| **VPS commit** | `757f0b43` (`docs: add Cursor session handoff and active tasks`) |

---

## Last completed

- Cursor-first **audit** confirmed existing governance pack (`01`–`07`, four `.cursor/rules/*.mdc`, `.gitignore` for rules).
- **Operational layer added:** `00_index.md`, `08_active_tasks.md`, `09_session_handoff.md` (this file), minimal links in `01` and `project-operating-rules.mdc`.
- UTF-8 mojibake cleanup completed for docs/ai-context/01–07 and verified clean.
- **OPERATOR-OS.1** completed in the current governance commit (session handoff, active tasks, operational layer).
- VPS-VERIFY.1 completed: production checkout synced to 757f0b43, containers running, API health 200.
- PA-V2-SMOKE.1 completed: ORCL V2 UI opened, two /analysis requests returned cacheStatus=hit/provider=anthropic, no premium/analysis API errors.

---

## Current focus

PA-V2-2D — controlled V2 cost governance and cache metadata.

---

## Next operator step

Prepare PA-V2-2D scope in Cursor Local. Do not enable V2 globally.

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

---

## Copy-paste prompt for next Cursor session

```
Read docs/ai-context/00_index.md, then 09_session_handoff.md and 08_active_tasks.md.
Do not rely on chat history.

Verify local git: git status, git branch --show-current, git rev-parse HEAD.
Report whether local matches 119ddb25 or has drift.

Next priority: VPS-VERIFY.1 (production SHA), then PA-V2-SMOKE.1 (ORCL cache smoke on VPS).
Docs-only unless I say otherwise. No commit unless I ask.
Local = coding/build/test; VPS = deploy/logs/smoke.
```
