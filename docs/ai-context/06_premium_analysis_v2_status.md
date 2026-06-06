# Premium Analysis V2 Status

**Endpoint:** `GET /api/premium/:ticker/analysis?language=en`
**Feature flag (frontend):** `VITE_PREMIUM_ANALYSIS_V2_ENABLED` or `localStorage.stockai.premiumAnalysisV2` — default OFF until explicitly enabled

---

## Pipeline overview

```
buildStockAIDataSnapshot
  -> createSnapshotHash
  -> cache lookup (Redis) — hit skips usage limit and Anthropic
  -> withSingleFlight (leader only)
       -> leader cache recheck
       -> enforcePremiumAnalysisDailyLimit (fresh generation only)
       -> callAnthropicForContract
            -> parseJsonObject
            -> normalizePremiumAnalysisCandidate
            -> validatePremiumAnalysisContract (Zod)
            -> optional repair (fast first call only)
       -> cache write on success
  -> waiter: poll cache OR SingleFlightTimeoutError -> deterministic fallback (no Anthropic)
```

**Key files:**

| File | Purpose |
|------|---------|
| `premiumAnalysisOrchestrator.ts` | Orchestration, repair guard, telemetry, single-flight |
| `premiumAnalysisCandidateNormalizer.ts` | Deterministic schema drift fixes (2L–2O) |
| `premiumAnalysisContract.ts` | Zod schema |
| `premiumAnalysisUsageLimit.ts` | Daily fresh-generation limits (trial-aware) |
| `rateLimiter.ts` | Global monthly `/api/premium/*` cap (trial-aware) |
| `premiumCompany.ts` | HTTP route |

---

## Recent commits (deployed context)

| Commit | Summary |
|--------|---------|
| `f6b310ca` | Tighten premium analysis repair budget (2J) |
| `92163c0f` | Log premium analysis validation failures (2K) |
| `818678be` | Normalize premium analysis contract candidates (2L) |
| `fabc61fa` | Normalize nested contract drift (2M) |
| `d0fc5f7a` | Normalize tail metadata (2N) |
| `04a635f5` | Normalize historicalTwins.summary (2O) |

Earlier infra (not repeated here): 2A–2I covering contract foundation, orchestrator, usage limits, trial access, latency guard, single-flight, auth-aware rate limiter.

---

## Normalizer coverage (2L–2O)

**Top-level / aliases**

- `technicalContext` -> `technicalSetup`
- `dataFreshness`: `computedAt`, `sources[].id`, `snapshotVersion`, `coverage`, `missingData`
- `valuationContext`: `summary`, numeric string metrics, `asOf`
- `scenarios`: `horizonMonths`, `narrative`, delete `priceTarget: null`
- `executiveVerdict`: `headline`, `educationalNote`, `summary` aliases
- Top-level `dataCoverage` / `missingData` sync with snapshot

**Nested (2M)**

- `businessEngine`: overview, competitiveDynamics, catalysts[], risks[]
- `technicalSetup`: summary, trend, levels; snapshot support/resistance levels
- `riskMap`: summary, item id/title/description/category/severity/likelihood

**Tail metadata (2N)**

- `historicalTwins.lesson`
- `thesisInvalidators.summary`, item `impact`/`monitor`
- `decisionNote.note`, `keyQuestions[]`

**2O**

- `historicalTwins.summary` from aliases or conservative zero-twin message

---

## Telemetry events (2K)

| Event | Meaning |
|-------|---------|
| `premium_analysis_llm_empty_response` | No usable text block |
| `premium_analysis_llm_parse_failed` | JSON parse failed (often `max_tokens`) |
| `premium_analysis_llm_validation_failed` | Zod failed after normalization |
| `premium_analysis_llm_normalized_contract` | Validation succeeded after normalizer changed fields |

Debug raw preview: `PREMIUM_ANALYSIS_DEBUG_RAW=1` only (max 1000 chars).

---

## Production proof (ORCL, after 2O)

- Full Anthropic V2 contract returned (not deterministic fallback).
- UI: Provider anthropic, cache miss.
- Log: `premium_analysis_llm_normalized_contract` with changed fields including `dataFreshness.snapshotVersion` and `dataFreshness.coverage`.

---

## Limits and gates (unchanged by normalizer)

| Layer | Behavior |
|-------|----------|
| Global rate limiter | Trial/active access bypass for monthly free cap |
| Product access middleware | 403 when no active access |
| Daily usage limiter | 429 `PREMIUM_ANALYSIS_DAILY_LIMIT` on cache miss only |
| Single-flight | No duplicate leaders; waiters do not consume quota |

---

## Next recommended improvements

1. **Cache test for ORCL** — second request should be cache hit; confirm usage limit skipped.
2. **max_tokens / prompt compaction** — reduce truncation `parse_failed` rate (separate from normalizer).
3. **Data coverage** — wire more snapshot fields; reduce conservative fallback frequency.
4. **Quality gate** — optional post-validation checks for weak/empty narratives while still schema-valid.

---

## QA checklist (fresh browser test)

1. Unregister service workers for `stock-ai.pro`.
2. Clear site data / hard refresh.
3. Enable V2 flag if testing new UI chunk.
4. Single `GET /api/premium/{TICKER}/analysis` with auth header.
5. Verify response `provider.name`, `cacheStatus`, and API logs.
