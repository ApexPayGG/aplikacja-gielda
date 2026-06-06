# Session Handoff

Short restart document for new Cursor sessions. **Update this file after substantive work.**

---

## Git state (verify — do not trust without running commands)

| Field | Value |
|-------|-------|
| **current local branch** | `main` |
| **current local commit** | `verify with git log -1 --oneline` - expected message: `docs: add Cursor session handoff and active tasks` |
| **VPS commit** | `unknown until verified` — run on production checkout per `03_deployment_runbook.md` |

---

## Last completed

- Cursor-first **audit** confirmed existing governance pack (`01`–`07`, four `.cursor/rules/*.mdc`, `.gitignore` for rules).
- **Operational layer added:** `00_index.md`, `08_active_tasks.md`, `09_session_handoff.md` (this file), minimal links in `01` and `project-operating-rules.mdc`.
- UTF-8 mojibake cleanup completed for docs/ai-context/01–07 and verified clean.
- **OPERATOR-OS.1** completed in the current governance commit (session handoff, active tasks, operational layer).

---

## Current focus

VPS-VERIFY.1 — verify production SHA before PA V2 smoke.

---

## Next operator step

1. **VPS:** verify production git SHA and compare with local main.
2. Update this file with VPS SHA; then run `PA-V2-SMOKE.1` if VPS is at or past PA V2 normalizer commits (`04a635f5`+)

---

## Open blockers

| Blocker | Notes |
|---------|-------|
| VPS SHA unknown | Cannot confirm ORCL smoke reflects latest API image |
| `STRIPE-LIVE.1` | Blocked on owner + live Stripe verification |

---

## Do not forget

- Chat history is **not** source of truth — read `00_index.md` first.
- **Local Cursor** = code / build / test. **VPS Cursor** = deploy / logs / smoke.
- Commit only when operator explicitly asks.
- After backend changes: targeted tests + `apps/api` build (not required for docs-only tasks).
- `optionalAuth` must stay before rate limiter in `server.ts`.
- Do not weaken PA V2 normalizer, validation, single-flight, or usage limits without approval.

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
