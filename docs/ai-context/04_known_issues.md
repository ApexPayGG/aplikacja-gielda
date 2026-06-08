# Known Issues Log

Structured tracker for agents and operators. Update when status changes.

---

## Open

| ID | Issue | Notes |
|----|-------|-------|
| O-001 | **max_tokens truncation** | Some fresh `/api/premium/:symbol/analysis` calls hit `stopReason: max_tokens`; JSON parse fails before normalizer helps. Future: prompt compaction and/or token budget review. |
| O-002 | **Valid-but-weak contracts** | Zod may pass while narrative quality is thin; no quality gate yet. |
| O-003 | **Data coverage gaps** | Missing/stale snapshot fields produce conservative analysis and larger `missingData` arrays. |

---

## Investigating

| ID | Issue | Notes |
|----|-------|-------|
| I-001 | **Symbol-specific fallback** | Some tickers may still fallback if output is structurally incomplete beyond safe normalization. Use 2K telemetry (`parse_failed` vs `validation_failed`) to triage. |
| I-002 | **ORCL `probabilityPct` validation** | Post–Commit 1 deploy: `premium_analysis_llm_validation_failed` — `scenarios.scenarios.*.probabilityPct` missing. PA V2 quality/normalizer issue, not cache-envelope failure. |
| I-003 | **Daily digest Anthropic model** | Log: model not found `claude-sonnet-4-20250514`. Separate scheduler/config issue; unrelated to PA V2 cache envelope. |

---

## Fixed (recent Premium Analysis V2 infra)

| ID | Issue | Fix reference |
|----|-------|---------------|
| F-001 | Trial users hit global 429 on `/api/premium/*` | Trial-aware rate limiter + `optionalAuth` before limiter (2G/2H) |
| F-002 | 504 from double Anthropic repair | Repair budget (2J), single-flight (2I), latency guard (2F) |
| F-003 | Generic fallback with no diagnostic | Validation telemetry (2K) |
| F-004 | Contract alias/type drift | Normalizer layers 2L–2O |
| F-005 | `historicalTwins.summary` missing | 2O conservative fill |
| F-006 | Nested drift (businessEngine, technicalSetup, riskMap, tail metadata) | 2M, 2N |

---

## Regression risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-001 | **Service Worker / browser cache** | Fresh UI tests: unregister service workers, hard refresh, clear site data. Stale bundles can show old error messages after API fix. |
| R-002 | **Normalizer invents investment substance** | Rules in `07_financial_safety.md` and `financial-domain-safety.mdc`; tests for alias-only fills. |
| R-003 | **Rate limiter order vs auth** | `optionalAuth` must stay before `createRateLimiterMiddleware` in `server.ts`. |
| R-004 | **Single-flight waiter timeout** | Waiters get deterministic fallback, not second Anthropic call — do not set `allowFallbackExecution: true`. |
| R-005 | **Redis unavailable** | Single-flight and rate limits fall back to in-memory behavior per process — behavior under multi-instance: **UNKNOWN - verify** |

---

## Testing hygiene

- Premium analysis: check Network tab for `/api/premium/{TICKER}/analysis`, not only UI message.
- Compare API `cacheStatus`, `provider.name`, and logs for `premium_analysis_llm_normalized_contract` vs `validation_failed`.
- After frontend deploy, confirm lazy chunk hash changed if V2 UI was updated.
