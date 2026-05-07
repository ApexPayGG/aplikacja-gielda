# Źródła danych dywidend — StockAI Pro (Phase 10 hybrid)

## Architektura

1. **PRIMARY: EODHD** — `GET https://eodhd.com/api/div/{SYMBOL}.US?from=…&api_token=…&fmt=json`  
   - Mapowanie: `date` → `exDate`, `paymentDate` → `payDate`, `value` → `amount`, `period` → `frequency`, `currency`.  
   - Kod: `src/scrapers/dividends.ts` — `fetchDividendHistory(symbol, years)`.

2. **FALLBACK: Finnhub** — `GET https://finnhub.io/api/v1/stock/dividend?symbol=&from=&to=&token=`  
   - Gdy EODHD rzuca błąd **albo** podejrzewamy **ucięcie historii** (plan Free ~1 rok przy długim `from`).  
   - Wtedy merge po dacie ex: wiersze EODHD mają pierwszeństwo, Finnhub uzupełnia braki.  
   - Kod: `fetchDividendHistoryFinnhub`, `fetchDividendHistoryHybrid`.

3. **Serwis:** `src/services/dividendDataService.ts`  
   - `syncDividendHistory(symbols)` — pętla po symbolach, częściowe sukcesy (błąd jednego nie zatrzymuje batcha).  
   - Kasuje w DB `source` ∈ `mock_seed` | `eodhd` | `finnhub` | `hybrid`, wstawia świeże `Dividend` + przelicza `DividendHistory` (CAGR / YoY).  
   - Po sync: invalidacja cache Redis (`dividend:history:*`, screener).

4. **BullMQ:** `src/jobs/syncDividends.ts`  
   - Kolejka: **`dividend-sync`**.  
   - Harmonogram: **codziennie 01:00 UTC** (`pattern: 0 1 * * *`, `tz: Etc/UTC`).  
   - Retry joba: **3** próby, backoff wykładniczy (konfiguracja kolejki).  
   - Logi: **pino** (`scope: dividend_job`).

5. **Scheduler:** `src/scheduler.ts` rejestruje worker + harmonogram powyżej.

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| `EODHD_API_KEY` | Wymagane do produkcji (poza testem `demo` tylko dla `AAPL.US`). |
| `FINNHUB_API_KEY` | Zalecane dla fallbacku i merge przy free tier EODHD. |
| `EODHD_DIVIDEND_EXCHANGE` | Domyślnie `.US` (np. `.LSE`). |
| `EODHD_DIVIDEND_FROM_YEAR` | Opcjonalnie `YYYY` — stałe `from=YYYY-01-01` zamiast wyliczenia z `DIVIDEND_SYNC_YEARS`. |
| `DIVIDEND_SYNC_SYMBOLS` | CSV symboli (domyślnie 10 tickerów dywidendowych z seeda). |
| `DIVIDEND_SYNC_YEARS` | Lata wstecz (domyślnie `10`). |
| `DIVIDEND_SYNC_DELAY_MS` | Opóźnienie między tickerami (domyślnie `600` ms) — rate limit. |
| `DIVIDEND_SYNC_USE_DB_TOP` | `1` / `true` — pierwsze 100 spółek z tabeli `Company` (sort `symbol`), inaczej lista z env. |
| `DIVIDEND_EODHD_DEMO` | `1` — bez klucza EODHD użyj tokena `demo` **tylko** dla `AAPL.US` (dev). |
| `LOG_LEVEL` | Poziom logów pino (`info`, `debug`, …). |

## API HTTP (read path)

- `GET /api/dividends/:symbol` — dane z **Postgres** (`Dividend`), cache Redis **24h** (`REDIS_TTL_SEC.DIVIDEND`).  
- `GET /api/screeners/dividend/growth` — `DividendHistory` + ostatnie `yield` z `Dividend`; cache screenera jak w `config/redis.ts`.

## Skrypty npm

| Skrypt | Opis |
|--------|------|
| `npm run dividends:sync` | Jednorazowy import dla listy symboli. |
| `npm run dividends:migrate` | Backup `mock_seed` → `results/dividend_mock_backup.json`, potem sync. |
| `npm run dividends:validate` | Smoke: EODHD `demo` + opcjonalnie Finnhub (wymaga ważnego klucza; free bywa 403 na części endpointów). |
| `npm run dividends:history` | Przelicza **DividendHistory** (totalAmount, YoY, **CAGR5Y**, **CAGR10Y**) z istniejących wierszy `Dividend` — patrz `calculateAndStoreDividendHistory`. |

## Seed / mock

- `DIVIDEND_SEED_MOCK=false` — `db:seed` nie wstawia mocków; potem `dividends:sync` lub `dividends:migrate`.  
- Mock pozostaje w repozytorium jako **referencja formatu**; backup JSON przy migracji.

## Troubleshooting

| Problem | Działanie |
|---------|-----------|
| EODHD tylko ~1 rok historii | Typowe dla **Free** EODHD — włącz `FINNHUB_API_KEY` lub plan płatny; hybryda scala Finnhub przy wykryciu ucięcia. |
| Finnhub 403 | Endpoint dywidend może wymagać wyższego planu / innego scope — sprawdź konto Finnhub. |
| `Company not found` | `db:seed` (firmy) przed synciem. |
| Redis po sync nadal stare | Invalidacja jest best-effort; TTL 24h i tak odświeży dane. |
| Rate limit | Zwiększ `DIVIDEND_SYNC_DELAY_MS`; job BullMQ ma własne retry. |

## Inne API (referencja)

- **Alpha Vantage** `function=DIVIDENDS` — alternatywa; limit **25 req/dzień** na free — słabe pod 100+ tickerów.  
- **Finnhub** — dokumentacja: [stock dividends](https://finnhub.io/docs/api/stock-dividends).  
- **EODHD** — dokumentacja: [api-splits-dividends](https://eodhd.com/financial-apis/api-splits-dividends/).
