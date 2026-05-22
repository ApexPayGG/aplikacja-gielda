# Company logo backfill (API)

Systemically fills `companies.logoUrl` for rows that are `null`, without hand-editing individual tickers in the UI.

## Why

- Frontend `CompanyLogo` and `GET /api/companies/logos` already use `companies.logoUrl`.
- Many universe rows still have `logoUrl = null` → ticker monogram fallback.
- Search ranking and logo sanitization do **not** replace a proper DB backfill.

## How it works

Module: `apps/api/src/modules/companies/companyLogoBackfill.ts`

For each company (batch, `logoUrl IS NULL` by default):

1. **DB variants (same base ticker)**  
   Copy from another listing only if `areLikelySameCompanyName()` passes (e.g. `AAPL` ↔ `AAPL.US`, `TSLA` ↔ `TSLA.US`, `ALE` ↔ `ALE.WAR`).

2. **EODHD fundamentals**  
   `General.LogoURL` via existing `normalizeLogoUrl()` (requires `EODHD_API_KEY`).

3. **Finnhub profile2**  
   Existing `fetchCompanyProfile()` scraper (requires `FINNHUB_API_KEY`).

Updates are skipped when no provider returns a logo. Existing `logoUrl` values are **not** overwritten unless `--force` is passed.

## Safety rules (no cross-company contamination)

| Case | Allowed? |
|------|----------|
| `AAPL` → `AAPL.US`, same name | Yes |
| `TSLA` / `TSLA.US`, same issuer | Yes |
| `BDX` (Budimex) ← `BDX.US` (Becton Dickinson) | **No** — same base, different names |
| `PEO` (Bank Pekao) ← unrelated `PEO.*` | **No** |
| `1299.HK` with no provider logo | Stays `null` (OK) |

Same-name helper as search: `areLikelySameCompanyName()` in `companySearchModule.ts`.

## CLI

From `apps/api`:

```bash
# Preview (no DB writes)
npm run logos:backfill -- --limit=500 --dry-run

# Apply updates (up to 500 rows with null logoUrl)
npm run logos:backfill -- --limit=500

# Re-process rows that already have logoUrl (use with care)
npm run logos:backfill -- --limit=100 --force
```

### Example dry-run output

```
[logos:backfill] limit=500 dryRun=true force=false
dryRun: true
scanned: 500
updated: 312
copiedFromExistingVariant: 148
fetchedFromEodhd: 142
fetchedFromFinnhub: 22
skippedNoProviderLogo: 188
skippedUnsafeMatch: 37
errors: 0
```

## What not to do manually

- Do not maintain a large hardcoded `symbol → logo URL` map in the frontend.
- Do not copy logos between symbols in SQL without the name-safety checks above.
- Do not use StockAI / brand assets as company placeholders.

## Operations

- Run backfill after bulk imports or when new exchanges are added.
- Prefer smaller batches (`--limit=500`) and monitor `errors` / `skippedUnsafeMatch`.
- EODHD calls are rate-limited with a short delay between requests.

## Tests

```bash
cd apps/api
node --import tsx/esm --test src/modules/companies/companyLogoBackfill.test.ts
```
