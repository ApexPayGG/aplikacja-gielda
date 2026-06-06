# Product Decisions (ADR-style)

Lightweight decision log for Cursor agents. Not a substitute for owner sign-off on pricing or legal text.

---

## ADR-001: Cursor-first workflow with repo docs as source of truth

**Status:** Accepted (May 2026)

**Context:** Agents and humans need persistent, versioned project context.

**Decision:** Maintain `docs/ai-context/` and `.cursor/rules/` as the first read for major work. Legacy briefs (`STOCKAI_PRO_*.md`) remain supplementary.

**Consequences:** Update context docs when production behavior or deploy process changes materially.

---

## ADR-002: Premium Analysis V2 must fail safely and visibly

**Status:** Accepted

**Decision:** Prefer deterministic fallback (200 + contract) over opaque 504 or silent bad JSON. Log structured failure reasons (`premium_analysis_llm_parse_failed`, `premium_analysis_llm_validation_failed`).

**Consequences:** UI may show fallback provider; operators use logs to distinguish infra vs model vs schema issues.

---

## ADR-003: LLM output normalized and Zod-validated before frontend use

**Status:** Accepted (2Lâ€“2O)

**Decision:** No raw Anthropic JSON reaches the client without `normalizePremiumAnalysisCandidate` + `validatePremiumAnalysisContract`.

**Consequences:** Normalizer may fix schema drift; must not invent price targets, analyst ratings, or bullish/bearish substance not in snapshot/model text.

---

## ADR-004: No extra Anthropic repair after slow first call

**Status:** Accepted (2J)

**Decision:** `shouldAttemptPremiumAnalysisRepair` returns false when first call latency exceeds repair budget (~20s) or truncation signals fire.

**Consequences:** More deterministic fallbacks on slow/invalid first responses; lower cost and tail latency.

---

## ADR-005: Deterministic fallback remains the safety net

**Status:** Accepted

**Decision:** `buildFallbackPremiumAnalysisContract` stays when validation fails or API key missing. Usage limit exceeded still returns 429 (`PREMIUM_ANALYSIS_DAILY_LIMIT`), not fallback.

---

## ADR-006: Backend-only deploy for API-only changes

**Status:** Accepted

**Decision:** Premium Analysis pipeline changes typically require only `api` container rebuild/restart on VPS.

**Consequences:** Frontend feature flags and service worker may lag until a separate frontend deploy â€” document in QA steps.

---

## ADR-007: Single-flight coalescing for premium analysis generation

**Status:** Accepted (2I)

**Decision:** One leader per `ticker + snapshotHash + language` executes Anthropic; waiters poll cache or receive timeout fallback without charging usage quota.

---

## ADR-008: Educational framing, not investment advice

**Status:** Accepted (legal/product)

**Decision:** Copy and contracts use educational language; disclaimers remain in frontend locales (`legal.*` keys).

**See:** `07_financial_safety.md`
