# AI Context Index

**Primary source of truth for Cursor agents and operators:** `docs/ai-context/` (versioned in git). Legacy briefs (`STOCKAI_PRO_*.md`) are supplementary only.

**Chat history is not source of truth.** Start each session from these files, not from prior conversation summaries.

---

## Operator environments

| Environment | Role |
|-------------|------|
| **Local Cursor** | Coding, `npm run build`, targeted tests, local `git status` / diff, commits when explicitly requested |
| **VPS Cursor** | Deploy (`03_deployment_runbook.md`), production logs, smoke checks, `git rev-parse HEAD` on production checkout |

Do not run production deploy or VPS log inspection from Local unless SSH/remote access is explicitly in scope. Do not treat Local build success as proof of production state.

---

## Reading order (new session)

1. `00_index.md` (this file)
2. `09_session_handoff.md` — last session state, blockers, copy-paste prompt
3. `08_active_tasks.md` — what to do next
4. `01_project_state.md` — current focus and priorities
5. Task-specific files below as needed

---

## File roles (01–09)

| File | Role |
|------|------|
| `00_index.md` | Navigation, reading order, Local vs VPS, truth-source rules |
| `01_project_state.md` | Current project focus, monorepo layout, PA V2 summary, agent entry points |
| `02_architecture.md` | Stack, services, data stores, LLM path, deployment topology |
| `03_deployment_runbook.md` | Pre-deploy local steps, VPS backend/frontend deploy, drift detection |
| `04_known_issues.md` | Open / investigating / fixed issues and regression risks |
| `05_product_decisions.md` | ADR-style decisions (PA V2, deploy, financial framing) |
| `06_premium_analysis_v2_status.md` | PA V2 pipeline, commits, normalizer, telemetry, QA checklist |
| `07_financial_safety.md` | Financial domain and LLM output safety rules |
| `08_active_tasks.md` | Operator task queue (status, owner, risk, next action) |
| `09_session_handoff.md` | Short restart handoff for the next Cursor session |

---

## Cursor rules (`.cursor/rules/`)

Applied automatically by Cursor; pointers only:

- `project-operating-rules.mdc` — scope, context docs, session handoff updates
- `security-and-testing.mdc` — secrets, validation, tests
- `deployment-safety.mdc` — VPS deploy safety (see also `03`)
- `financial-domain-safety.mdc` — globs for premium/financial paths (see also `07`)

---

## After substantive work

Update `09_session_handoff.md` and relevant rows in `08_active_tasks.md`. Do not rely on the chat thread to carry state forward.
