# Phase 11 — AI Scoring Engine (Dividend Sustainability)

Plan wdrożenia po researchu (ingest fundamentals → silnik liczbowy → AI → DB → API → batch). **Kolejność ma znaczenie.**

---

## Stan wyjściowy (skrót)

- Historia dywidend: **tak** (`Dividend`, `DividendHistory`, EODHD + Finnhub).
- Cena: **tak** (Finnhub → `Quote`; Alpha opcjonalnie).
- EPS / FCF / OCF: **nie** w obecnym ingestcie — model `Fundamental` + `insertFundamental` istnieje, ale **brak zasilania** z zewnętrznych API.

---

## Faza A — Dane fundamentalne (blokujące)

| # | Zadanie | Uwagi |
|---|---------|--------|
| A1 | **Decyzja źródła** | Preferencja: **EODHD fundamentals** (spójność z dywidendami, suffix `.US`). Fallback: Finnhub / Alpha tylko przy braku pola lub testach. |
| A2 | **Kontrakt metryk** | Np. `eps_ttm`, `fcf_ttm`, `ocf_ttm`, ewent. `shares_outstanding`; `metric` + `value` w `Fundamental` (lub osobna `FundamentalSnapshot` z `as_of`). |
| A3 | **`syncFundamentals(symbol)`** | Scraper: mapowanie JSON → `insertFundamental` / upsert. Retry na 429, jawne błędy przy braku danych. |
| A4 | **Batch** | Ta sama lista symboli co dywidendy (lub top N). Limit równoległości + **dzienny budżet** requestów. |

**Akceptacja:** dla ≥10 tickerów z seeda w DB są wartości EPS/FCF **albo** kontrolowany brak (log + brak crasha).

---

## Faza B — Silnik deterministyczny (bez AI)

| # | Zadanie | Uwagi |
|---|---------|--------|
| B5 | **Moduł scoringu** (np. `dividendSustainabilityMath.ts`) | Wejścia: `DividendHistory`, `Fundamental`, opcj. `Quote`. Wyjścia: 4 składowe **0–100** + pośrednie (`payoutRatio`, `fcfCoverage`, `consistencyIndex`). **Jedna** logika skali payoutu (gładka *lub* piecewise — nie obie naraz). |
| B6 | **Predykcja DPS** | Np. 5 ostatnich lat `totalAmount` → OLS → prognoza Y+1, `predictionLabel` (up/down/stable), `confidence` (R² + heurystyka „stable” przy małym \|slope\|). |

**Akceptacja:** testy jednostkowe na sztucznych szeregach (wzrost, spadek, płaski, szum).

---

## Faza C — AI (Claude Haiku)

| # | Zadanie | Uwagi |
|---|---------|--------|
| C7 | **Prompt + JSON schema** | Input: tylko liczby i fakty (bez HTML). Output: `{ score, explanation, flags[] }`, **temperature 0**. |
| C8 | **Koszt i limity** | On-demand: limit N/h (IP lub klucz). Batch: kolejka, skip jeśli świeży snapshot (&lt; 24h) bez `force`. |
| C9 | **Łączenie** | `final = 0.3·a + 0.3·b + 0.2·c + 0.2·d` (wersjonować `modelVersion` w DB/config). |

**Akceptacja:** powtarzalny wynik przy tym samym inpucie (deterministyczny tryb modelu).

---

## Faza D — Persystencja

| # | Zadanie | Uwagi |
|---|---------|--------|
| D10 | **Migracja Prisma** | Tabela np. `DividendSustainabilityScore`: `symbol` **@unique**, `sustainabilityScore`, składowe (`payoutScore`, `coverageScore`, `consistencyScore`, `aiScore`), `predictedChangePct`, `predictionConfidence`, `predictionLabel`, `explanation`, opcj. `componentsJson`, `lastCalculatedAt`, `modelVersion`. |
| D11 | **Zapis po obliczeniu** | Upsert po `symbol` + aktualizacja `lastCalculatedAt`. |

---

## Faza E — API i kolejka

| # | Zadanie | Uwagi |
|---|---------|--------|
| E12 | **HTTP** | `GET /api/ai/dividend/sustainability/:symbol` — z DB; opcj. `?refresh=1` tylko dla zaufanych klientów. `GET /api/ai/dividend/prediction/:symbol` — może być częścią tego samego payloadu lub osobno. `POST /api/ai/dividend/analyze` — `{ "symbol": "AAPL" }` → przeliczenie + zapis; **429** przy limicie. |
| E13 | **Cron / BullMQ** | Codziennie: sync fundamentals + przeliczenie listy symboli (chunki). |

**Akceptacja:** `curl` GET zwraca ostatni snapshot; POST aktualizuje `lastCalculatedAt`.

---

## Faza F — Jakość i produkcja

| # | Zadanie |
|---|--------|
| F14 | Logi + metryki: czas obliczenia, błędy zewnętrznych API, zużycie tokenów AI. |
| F15 | Uzupełnienie `apps/api/.env.example` (limity, włączniki batch AI). |
| F16 | Frontend: podłączenie po ustabilizowaniu kontraktu GET (osobny task). |

---

## Sprinty (sugerowane opakowanie)

| Sprint | Zakres |
|--------|--------|
| **S1** | A1–A4 |
| **S2** | B5–B6 + testy |
| **S3** | D10–D11 + E12 (GET/POST, bez cron) |
| **S4** | C7–C9 + integracja AI w pipeline |
| **S5** | E13 + F14–F15 (F16 opcjonalnie później) |

---

## Odnośniki w repo

- Źródła dywidend: `apps/api/docs/DIVIDEND_DATA_SOURCES.md`
- Strategia cache: `apps/api/docs/REDIS_CACHE_STRATEGY.md`
- Research API / formuła / regresja: ustalenia z sesji planowania Phase 11 (EODHD vs reszta, OLS zamiast sklearn na start).

---

*Ostatnia aktualizacja: backlog zapisany na prośbę użytkownika — do aktualizacji wraz z postępem implementacji.*
