# Financial Domain Safety

Rules for Stock-AI Pro features that surface market data, AI analysis, or educational investment context.

---

## Core principles

1. **Educational framing** — not personalized investment advice or guaranteed outcomes.
2. **No fabricated market facts** — do not invent analyst ratings, consensus targets, historical twins, or metrics not grounded in snapshot/data sources.
3. **Show uncertainty** — missing, stale, `not_wired`, or `requires_access` fields must appear in `missingData` / `dataCoverage` and narrative where relevant.
4. **Schema-validated LLM output** — Zod validation is mandatory before caching or returning contracts to clients.
5. **Conservative fallback** — deterministic fallback contract is allowed; it must validate and avoid analyst fiction (see `premiumAnalysisFallback.ts` tests).

---

## Premium Analysis V2 specific rules

| Rule | Implementation |
|------|----------------|
| No price targets unless grounded | Schema allows optional `priceTarget` with `basis`/`source`; normalizer deletes `null` priceTarget |
| No analyst consensus | Fallback tests assert no fabricated ratings |
| Normalizer fixes shape only | Alias mapping and metadata defaults OK; no invented bull/bear thesis |
| Trial users get fair access | Rate limits and usage limits are trial-aware; not unlimited FREE |
| Usage exceeded is explicit | 429 with `PREMIUM_ANALYSIS_DAILY_LIMIT`, not silent fallback |

---

## External data handling

- Treat upstream API/scraper payloads as **untrusted** until validated.
- Use typed snapshot fields with `status: ok | missing | stale | not_wired | requires_access`.
- Numeric claims in contracts require `basis`, `source`, and `asOf` when present in schema.

---

## LLM output handling

```
Anthropic raw text
  -> parse (fail -> log parse_failed -> fallback)
  -> normalize (shape drift only)
  -> Zod validate (fail -> log validation_failed -> fallback)
  -> cache / respond
```

- Do not log full raw LLM output in production (debug flag only, capped).
- Do not bypass normalization or validation for convenience.

---

## UI and copy

- Keep `InvestmentDisclaimer` / `AIDisclaimer` and locale `legal.*` strings intact.
- Do not present `executiveVerdict.label` as a direct buy/sell instruction.
- `decisionNote.stance` uses educational stances (`research`, `cautious`, etc.).

---

## What agents must not do

- Add guaranteed return language or certainty framing.
- Fabricate dividend yields, P/E, or price levels not in snapshot.
- Remove or weaken access controls to "make demo work."
- Hide fallback provider in API responses (transparency for debugging).
- Use `any` in business logic; validate at boundaries.

---

## When data is weak

- Prefer lower `executiveVerdict.confidence` in prompts (model guidance).
- Prefer concise copy and explicit `missingData` listing.
- Deterministic fallback is acceptable; misleading precision is not.
