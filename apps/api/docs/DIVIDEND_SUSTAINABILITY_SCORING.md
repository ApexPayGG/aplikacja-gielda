# Dividend sustainability scoring (Phase 11 Sprint 2)

Deterministic math only — no AI. Service: `src/services/dividendSustainabilityMath.ts`, types: `src/types/sustainability.ts`.

## Final score (placeholder for Sprint 4)

`finalScore = round(0.35 × payoutScore + 0.35 × coverageScore + 0.30 × consistencyScore)` — integer 0–100.

## Payout ratio score (0–100)

Uses **EPS TTM** (`Fundamental`: `metric=eps_ttm`, `year=0`) and **latest calendar-year DPS** (`DividendHistory.totalAmount` for the most recent year).

`payoutRatio = DPS / EPS` (fraction, e.g. 0.35 = 35%).

| Condition   | Score |
|------------|-------|
| &lt; 30%   | 100   |
| 30–40%     | 90    |
| 40–60%     | 70    |
| 60–80%     | 40    |
| ≥ 80%      | 0     |

Missing EPS or DPS → neutral **50** with explanation.

## FCF coverage score (0–100)

`fcfCoverage = (DPS × shares_outstanding) / FCF` — share of **free cash flow** consumed by total dividend cash (latest DPS year, latest **positive** fiscal `fcf` row; `shares_outstanding` aligned to that FCF year when present).

| Condition        | Score |
|-----------------|-------|
| &lt; 50% of FCF | 100   |
| 50–100%         | 80    |
| 100–150%        | 50    |
| ≥ 150%          | 0     |

Missing or non-positive **FCF** → neutral **50** (“unknown”). If FCF exists but shares are missing, coverage cannot be computed → **50**.

## Consistency score (0–100)

Last **5** `DividendHistory` rows (by year): YoY growth on `totalAmount`, count of **cuts** (YoY &lt; 0), volatility = **sample standard deviation** of YoY growth (%).

| Condition                                      | Score |
|-----------------------------------------------|-------|
| 0 cuts and σ &lt; 5%                          | 100   |
| 1 cut **or** σ in 5–15%                       | 70    |
| ≥ 2 cuts **or** σ &gt; 15%                    | 30    |
| Fewer than 2 years of history                 | 70 (partial) |

## Sprint 3 — API i persystencja

- **Tabela** `dividend_sustainability_scores` (Prisma: `DividendSustainabilityScore`) — snapshot: `finalScore`, trzy subscore, `payoutRatio`, `fcfCoverage`, `explanation`, pełny breakdown w `componentsJson` (JSON), `lastCalculatedAt`, `modelVersion`.
- **GET** `/api/ai/dividend/sustainability/:symbol` — odczyt z DB; odpowiedź `{ symbol, finalScore, breakdown, lastCalculatedAt }`; **404** gdy brak wiersza. Cache Redis: `cache:v1:sustainability:dividend:{SYMBOL}`, TTL **24 h** (`REDIS_TTL_SEC.SUSTAINABILITY_DIVIDEND`). Po zapisie (`saveSustainabilityScore`) klucz jest usuwany.
- **Zapis:** `src/services/dividendSustainabilityPersistenceService.ts` — `saveSustainabilityScore(symbol, breakdown)` (upsert + czyszczenie cache).
- **Skrypt:** `npm run sustainability:populate:s3` — pierwsze N symboli seed (`FUNDAMENTAL_S1_LIMIT`, domyślnie 10): `calculateSustainabilityScore` → `saveSustainabilityScore`. Wymaga istniejącego rekordu `Company` dla symbolu (FK).

## Scripts

- `npm run sustainability:test:s2` — JSON breakdown per symbol (needs `DATABASE_URL` + populated `Fundamental` / `DividendHistory`).
- `npm run test:sustainability` — unit tests (pure math).
- `npm run sustainability:populate:s3` — zapis snapshotów do DB dla listy seed.
