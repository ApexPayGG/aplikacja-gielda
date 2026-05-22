# Company `logoUrl` — backend backfill

## Frontend (current)

- `CompanyLogo` uses `logoUrl` / legacy `logo` when present.
- On image error → **ticker monogram** (no StockAI logo, no error UI).
- `resolveCompanyLogoUrl()` in `src/components/CompanyLogo.tsx`.

## Required API field

`companies.logoUrl` (nullable string) on:

| Endpoint / DTO | Notes |
|----------------|--------|
| `GET /api/companies`, search | Card grid |
| `GET /api/companies/:symbol` | Company detail |
| Signals feed rows | `logoUrl` or `logo` |
| Dividend screener rows | optional enrichment |
| Market events | optional join by `symbol` |

## Backfill pipeline (backend only)

1. **Source priority**
   - EODHD / provider company profile logo URL
   - Finnhub / Polygon logo endpoint (if licensed)
   - Manual override table for GPW / edge tickers
2. **Persist** on import (`importEodhd.ts`, `importEodhdGlobal.ts`) and periodic sync job.
3. **Cache** URL in DB; optional CDN proxy for hotlink stability.
4. **Do not** fetch arbitrary logo URLs from the browser (CORS / rate limits).

## Acceptance

- Actively traded watchlist symbols: target ≥95% non-null `logoUrl`.
- New company inserts set `logoUrl` at creation time.
- Frontend unchanged once API is populated; ticker fallback remains last resort.
