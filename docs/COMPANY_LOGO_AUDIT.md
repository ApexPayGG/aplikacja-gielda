# Company logo audit (read-only)

Finds existing `companies.logoUrl` values that may be contaminated (wrong EODHD exchange path) without modifying the database.

## Run

From `apps/api`:

```bash
npm run logos:audit
npm run logos:audit -- --limit=2000
npm run logos:audit -- --only-suspicious=true
npm run logos:audit -- --symbols=MRK.XETRA,MRK.US
npm run logos:audit -- --format=json --only-suspicious=true
```

On VPS after deploy:

```bash
cd apps/api && git pull && npm run logos:audit -- --limit=5000 --only-suspicious=true
```

## Rules

| logoUrl type | Result |
|--------------|--------|
| EODHD `/img/logos/{EX}/...` | Compare `{EX}` to company listing exchange |
| DAX ↔ XETRA | Allowed equivalence (same as backfill) |
| Finnhub / static2 | `externalProvider` — neutral, not flagged |
| Other URLs | `ok` — no exchange segment to validate |

**Suspicious example:** `MRK.XETRA` / XETRA with `.../logos/US/mrk.png` → `suggestedAction: clear`.

**OK examples:** `SIE.XETRA` + `/XETRA/SIE.png`; `ALV` / DAX + `/XETRA/ALV.png`; `AAPL` + Finnhub static URL.

## Output fields

- `symbol`, `name`, `exchange`, `logoUrl`, `urlExchange`
- `classification`: `ok` | `suspicious` | `externalProvider`
- `reason`, `suggestedAction`: `keep` | `review` | `clear`

Summary counters: `scanned`, `ok`, `suspicious`, `externalProvider`.

## Manual cleanup

This script does **not** update or delete rows. After review, clear bad URLs with SQL, e.g.:

```sql
UPDATE companies SET "logoUrl" = NULL WHERE symbol = 'MRK.XETRA';
```

Then re-run `npm run logos:backfill` if needed.
