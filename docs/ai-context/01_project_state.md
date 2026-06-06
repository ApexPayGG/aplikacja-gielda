# Project State

**Product:** Stock-AI Pro / Stock-AI Co-pilot
**Production domain:** https://stock-ai.pro
**Repository:** aplikacja-gielda (monorepo)
**Last updated:** May 2026 (Cursor-first context pack)

---

## Current focus

1. **Premium Analysis V2** — backend pipeline is production-stable for auth, rate limits, single-flight, repair budget, validation telemetry, and contract normalization (commits through `04a635f5`).
2. **Cursor-first workflow** — repo docs under `docs/ai-context/` and `.cursor/rules/` are the operational source of truth for agents and humans.
3. **Safe backend-only deploys** — API changes deploy without frontend rebuild when scope is limited to `apps/api`.

---

## Monorepo layout (visible in repo)

| Path | Role |
|------|------|
| `apps/api/` | Express API, Prisma, BullMQ jobs, premium analysis, auth, Stripe webhooks |
| `apps/frontend/` | React 18 + Vite SPA, i18n, premium analysis UI (V2 behind feature flag) |
| `packages/` | Shared packages (e.g. notifications, email) |
| `docker-compose.prod.yml` | Production stack: api, frontend, nginx, redis, timescaledb |
| `docs/` | Runbooks, QA checklists, AI context |
| `.github/workflows/` | CI/CD including `deploy.yml` |

---

## Production assumptions

- VPS hosts Docker Compose production stack.
- API listens on port **3000** inside the `api` container; nginx terminates TLS for `stock-ai.pro`.
- Environment secrets live in `.env.production` on VPS (never committed).
- GitHub `main` is the deployment branch; VPS must fast-forward merge to avoid drift.

---

## Premium Analysis V2 — summary status

| Area | Status |
|------|--------|
| 403 product access | Addressed (trial-aware global limiter + optionalAuth wiring) |
| 429 global monthly cap | Addressed for active trial users |
| 504 long double-call paths | Mitigated (repair budget, single-flight, latency guard) |
| Deterministic fallback | Still used when parse/validation fails after normalization |
| Anthropic success path | **Proven on ORCL** after 2O — full contract, `premium_analysis_llm_normalized_contract` log |
| Normalizer (2L–2O) | Handles top-level and nested schema drift before Zod validation |

See `06_premium_analysis_v2_status.md` for full technical history.

---

## Active priorities (recommended)

1. Cache verification for symbols that previously fell back (e.g. ORCL).
2. `max_tokens` / prompt compaction for truncated JSON (separate from normalizer).
3. Data coverage improvements in `StockAIDataSnapshot`.
4. Quality gate for valid-but-weak contracts (optional future work).

---

## Operational session layer

- **Start here:** `docs/ai-context/00_index.md` — reading order, Local vs VPS, truth-source rules.
- **Active tasks:** `docs/ai-context/08_active_tasks.md`
- **Session restart handoff:** `docs/ai-context/09_session_handoff.md`

---

## Agent entry points

- **Any major change:** read `00_index.md`, then this file.
- **Premium Analysis work:** read `06_premium_analysis_v2_status.md`.
- **Deploy:** read `03_deployment_runbook.md`.
- **Financial/LLM output:** read `07_financial_safety.md`.

---

## Related legacy docs (still useful)

- `STOCKAI_PRO_PROJECT_INSTRUCTIONS.md` — stack, conventions, pricing overview
- `STOCKAI_PRO_STRATEGIC_BRIEF_v5_0.md` / v7 variants — product vision
- `docs/production-launch-smoke-checklist.md` — post-deploy smoke tests
