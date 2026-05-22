# Company `logoUrl` — backend backfill note

## Current frontend behavior

- `CompanyLogo` uses `logoUrl` (or legacy `logo`) when present; on load error it shows a **ticker monogram** fallback (no StockAI branding, no error UI).
- `resolveCompanyLogoUrl()` in `src/components/CompanyLogo.tsx` normalizes empty strings to `null`.

## API fields already modeled (frontend)

| Surface | Type / field | File |
|--------|----------------|------|
| Company detail | `Company.logoUrl` | `src/services/api.ts` |
| Search suggestions | `results[].logoUrl` | `src/services/api.ts` |
| Signals rows | `logoUrl` / `logo` on row + optional local meta | `src/pages/SignalsPage.tsx` |
| Dividend screener rows | optional `logoUrl` on extended row | `src/pages/DividendPage.tsx` |

If `logoUrl` is `null`, the UI is **intentional** — not a failure.

## Where to add / backfill on backend (no frontend change required)

1. **Companies table / EODHD import**  
   Persist `logoUrl` when fundamentals or search sync returns a logo (same pipeline as `importEodhd.ts` / `importEodhdGlobal.ts`).

2. **Public list endpoints**  
   Include `logoUrl` in JSON for:
   - `GET /api/companies` (home / sector cards)
   - `GET /api/companies/search`
   - `GET /api/companies/:symbol`

3. **Signals / dividends / market-events aggregations**  
   Join `companies.logoUrl` (or cached logo column) when building:
   - signals feed DTOs
   - dividend growth screener rows
   - market event cards (optional enrichment by `symbol`)

4. **Backfill job**  
   One-off script: for rows where `logoUrl IS NULL`, fetch from EODHD logo URL pattern or stored CDN path; update `companies.logo_url`.

## Suggested acceptance criteria

- ≥95% of actively traded symbols in watchlists have non-null `logoUrl`.
- New imports set `logoUrl` at insert time.
- No frontend change needed once API returns the field consistently.
