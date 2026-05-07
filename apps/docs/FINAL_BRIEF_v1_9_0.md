# StockAI Pro — FINAL BRIEF v1.9.0

**Dokument:** `apps/docs/FINAL_BRIEF_v1_9_0.md`  
**Status:** gotowe do GitHub / stakeholderów  
**Okno czasowe:** 3–6 maja 2026 (rdzeń infrastruktury → monitoring → backupy → performance & Dividend MVP)

---

## Roadmap faz (skrót)

```
═════════════════════════════════════════════════════════════════

✅ PHASE 1–6: CORE INFRASTRUCTURE (3 May)
✅ PHASE 7: MONITORING (5 May)
✅ PHASE 8: BACKUPS (5 May)
✅ PHASE 9: PERFORMANCE & NEW FEATURE (6 May)
   ├─ 9.1: CDN (Cloudflare) ✓
   ├─ 9.2: DB Indexing ✓
   ├─ 9.3: Load Test BASELINE ✓
   ├─ 9.4: Dividend Screening MVP ✓
   ├─ 9.5: Redis Tuning ✓
   ├─ 9.6: Load Test FINAL ✓
   └─ 9.7: Final Brief ✓

═════════════════════════════════════════════════════════════════
```

### Phase 1–6 (3 May) — rdzeń

| Obszar | Dostarczone |
|--------|-------------|
| Dane | Scrapery (Finnhub, Alpha Vantage, EODHD), typy, testy integracyjne |
| Baza | Prisma + TimescaleDB, hypertable’e (`quotes`, `news`, `technical_indicators`) |
| API | Express REST, BullMQ scheduler, analiza Claude (Sonnet) |
| Spółki | Model `Company`, wyszukiwarka, sektory, loga (Finnhub) |
| Frontend | React 18 + Vite, dashboard, wykresy, newsy, CORS |
| Telegram | Bot (search, alerty, Redis) |
| Produkcja | Docker multi-stage, `docker-compose.prod`, nginx, szablon `.env.production` |

### Phase 7 (5 May) — monitoring

- **UptimeRobot** (lub równoważny) — ping `https://stock-ai.pro` / health.
- Alerty przy niedostępności API / frontu.

### Phase 8 (5 May) — backupy

- Skrypt backupu TimescaleDB → **S3** (np. `scripts/backup-to-s3.sh`, zmienne z `.env.backup.example`).
- Cron na VPS (np. codziennie w nocy).

### Phase 9 (6 May) — performance i moduł dywidend

| Podfaza | Treść |
|---------|--------|
| 9.1 | **Cloudflare** — DNS + proxy CDN przed origin (Hetzner). |
| 9.2 | **Indeksy Prisma** na `quotes`, `news`, `indicators`, `dividends`, `dividend_histories` (zapytania listowe i dywidendy). |
| 9.3 | **k6 baseline** — scenariusze A/B/C (~6 min), raport HTML + eksport JSON. |
| 9.4 | **Dividend Screening MVP** — API + seed 10 spółek + frontend + kalkulator podatku PL 19%. |
| 9.5 | **Redis** — `maxmemory` + `allkeys-lru`, TTL per typ cache, endpoint `/api/redis/stats`. |
| 9.6 | **k6 FINAL** — A–F (~10 min), porównanie baseline vs final (HTML + CSV). |
| 9.7 | **Ten dokument** — brief v1.9.0. |

---

## A. Executive summary

W ciągu **trzech dni roboczych** domknięto **monitoring i backupy**, wprowadzono **Cloudflare**, **indeksy pod zapytania API**, **pełny tor testów obciążeniowych** (baseline + final z modułem dywidend), **MVP ekranu dywidend** (API + UI + podatek PL) oraz **konfigurację cache Redis** z diagnostyką.

**Co widać po stronie metryk:**

- **Dostępność:** produkcja pod **https://stock-ai.pro** (nginx + Let’s Encrypt); monitoring zewnętrzny (Phase 7).
- **Wydajność:** baseline k6 ~**461 req/s** przy scenariuszach A–C; globalne opóźnienia rzędu **kilku ms** na ścieżkach health/search; test FINAL ~**216k** żądań łącznie z modułem dywidend — endpointy D–E–F **200 OK** w checkach k6.
- **Nowe feature:** moduł **Dividend Screening** (historia, screener wzrostu, kalkulator brutto/netto PL).

**Uwaga komunikacyjna:** globalny wskaźnik `http_req_failed` w k6 (~**5–7%**) wynika głównie z **404 na `/api/quotes/:symbol`**, gdy w DB brak świeżej kotacji — to znany temat testowy/produkcyjny (patrz sekcja **K**), a nie awaria modułu dywidend.

---

## B. Tech stack (finał v1.9.0)

### Aplikacja

| Warstwa | Technologie / wersje (referencyjnie z repo) |
|---------|---------------------------------------------|
| Runtime API | Node.js **20**, TypeScript **~5.3–5.6** |
| API | Express **4.21**, **tsx** |
| ORM / DB | Prisma **6.3**, `@prisma/client` |
| Cache / kolejki | Redis **7**, **ioredis**, **BullMQ** **5.34** |
| AI | **@anthropic-ai/sdk** **^0.90**, modele Sonnet w analizie |
| Frontend | React **18.3**, Vite **6**, Tailwind **3.4**, React Router **6.28**, Recharts **2.15** |
| HTTP client | axios |

### Infrastruktura

| Element | Opis |
|---------|------|
| VPS | **Hetzner** (np. CX23), Ubuntu, Docker |
| DNS / CDN | **Cloudflare** (strefa DNS, proxy, SSL do origin) |
| Reverse proxy | **nginx** (TLS z Let’s Encrypt na VPS) |
| Baza | **PostgreSQL 15** / **TimescaleDB** (hypertable’e na szeregi czasowe) |
| Redis | Kontener **redis:7-alpine**, `maxmemory` + `allkeys-lru`, AOF |
| CI/CD | **GitHub Actions** → SSH deploy na VPS (`appleboy/ssh-action`) |
| Monitoring | **UptimeRobot** (lub równoważny) |
| Backupy | **S3** + skrypt dzienny (Timescale dump) |

### Dokumentacja techniczna (API)

- Cache Redis: `apps/api/docs/REDIS_CACHE_STRATEGY.md`
- Źródła danych dywidend (na później): `apps/api/docs/DIVIDEND_DATA_SOURCES.md`

---

## C. Performance metrics

### Ostatni pomiar k6 (eksport JSON w repo)

**Baseline** (`apps/api/results/baseline-summary.json`) — wyłącznie scenariusze A–C, ~6 min:

| Metryka | Wartość |
|---------|---------|
| Żądania (`http_reqs` count) | **166 890** |
| Średni RPS (`http_reqs` rate) | **~461** |
| `http_req_duration` **p50** (med) | **~2.55 ms** |
| `http_req_duration` **p95** | **~7.38 ms** |
| `http_req_duration` **p99** | **~11.17 ms** |
| `http_req_failed` (wartość k6) | **~0.07** (**~7%** — głównie nie-2xx, typowo 404 quotes) |

**Final** (`apps/api/results/final-summary.json`) — A–F, ~10 min:

| Metryka | Wartość |
|---------|---------|
| Żądania (`http_reqs` count) | **216 553** |
| Średni RPS (średnia z całego testu) | **~359** |
| `http_req_failed` | **~5.4%** |
| Checki D / E / F (status 200) | **0 fails** w podsumowaniu |

Niższy średni RPS w FINAL wynika z **dłuższego czasu trwania** i **innego miksu** (POST tax, cięższy screener, równoległe fazy D+E).

### Porównanie scenariuszy (p95, ms) — CSV

Plik: [`apps/api/results/load-test-comparison.csv`](../api/results/load-test-comparison.csv)

```csv
scenario,baseline_p95,final_p95,difference_ms,improvement_%
A,6.93,6.84,-0.09,1.3
B,7.51,7.24,-0.26,3.5
C,8.36,8.11,-0.25,3.0
D,,8.08,,
E,,9.12,,
F,,4.64,,
```

**Redis:** cache dla quotes, search, dywidend i screenera **ogranicza koszt powtarzalnych odczytów**; w teście każdy VU w pętli uderza w te same URL — po rozgrzaniu kluczy w Redis opóźnienia pozostają niskie (widać to m.in. po p95 scenariuszy D–F).

### Zrzuty ekranu (load test)

Raporty są generowane jako **HTML** — otwórz w przeglądarce i zrób eksport do PNG/PDF dla prezentacji:

| Raport | Plik |
|--------|------|
| Baseline (domyślny z `load-test.js`) | [`apps/api/results/load-test-report.html`](../api/results/load-test-report.html) |
| **FINAL vs baseline** (porównanie) | [`apps/api/results/load-test-final-report.html`](../api/results/load-test-final-report.html) |
| Fragment surowy FINAL | [`apps/api/results/load-test-final-fragment.html`](../api/results/load-test-final-fragment.html) |

---

## D. Dividend Screening module (MVP)

### Endpointy (3 + screener)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/dividends/:symbol?years=5` | Historia dywidend (filtr lat), cache Redis 24h |
| `GET` | `/api/screeners/dividend/growth?minYears=&minYield=&page=&limit=` | Screener wzrostu dywidendy, cache agregatu |
| `POST` | `/api/dividends/tax-calculator-pl` | Body JSON: `shares`, `currentPrice`, `dividendPerShare` **lub** `annualDividendYieldPercent` — podatek **19%** PL |

### Dane

- **Seed:** ~**10 spółek** z przykładowymi wpisami `Dividend` / `DividendHistory` (`npm run db:seed` w `apps/api`).

### Frontend

- Trasa `/dividends`, tabele wzrostu, kalkulator podatku — integracja z `services/api.ts`.

### Następny krok (Phase 10+)

- Integracja z **rzeczywistym źródłem dywidend** (API vendor / EODHD / inny feed — patrz `DIVIDEND_DATA_SOURCES.md`).

---

## E. Infrastructure

| Składnik | Szczegóły |
|----------|-----------|
| VPS | **Hetzner**, aplikacja pod domeną **stock-ai.pro** |
| Cloudflare | **DNS** + **CDN/proxy**; origin na VPS |
| Deploy | **GitHub Actions** — build / pull / `docker compose -f docker-compose.prod.yml up` (dostosuj do workflow w repo) |
| TLS | **Let’s Encrypt** (certbot), volumy w nginx z `/etc/letsencrypt` |
| Monitoring | **UptimeRobot** — URL produkcyjny + ewentualnie `/health` |
| Backupy | **Codzienny** dump bazy do **S3**, retencja wg polityki organizacji |

### Architektura (ASCII)

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │  DNS + CDN      │
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │  nginx (VPS)    │
                    │  :443 → API/UI  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────────┐ ┌───▼──────┐ ┌────▼─────┐
     │  API (Node)     │ │ Frontend │ │ (opcj.)  │
     │  :3000          │ │  static  │ │ scanner  │
     └────────┬────────┘ └──────────┘ └──────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌───▼────┐ ┌──▼────┐
│Postgres│ │ Redis │ │  S3   │
│Timescale│ │ cache │ │backup │
└────────┘ └───────┘ └───────┘
```

---

## F. Database

- **Hypertable’e** (Timescale): m.in. `quotes`, `news`, `technical_indicators` (szczegóły w `schema.prisma` / migracjach).
- **Indeksy (9.2):** m.in. `(symbol, timestamp DESC)` na quotes/news/indicators; `(symbol)`, `(symbol, exDate)`, `(symbol, payDate)` na dywidendach; `(symbol, year)` na historii dywidend.
- **Modele MVP:** `Dividend`, `DividendHistory`, relacja do `Company`.

---

## G. Monthly costs (szacunek)

| Pozycja | Kwota |
|---------|--------|
| Polygon.io | **~$29**/mies. |
| EODHD | **~$20**/mies. |
| Claude (Sonnet + ewent. Haiku) | **~$40**/mies. (zależnie od użycia) |
| Hetzner VPS | **€4.91**/mies. |
| Cloudflare (strefa Free) | **$0** |
| Domena / rocznie | **~€33**/rok (Hetzner Domains — wg faktycznej faktury) |

**Suma orientacyjna:** ok. **~$89–100/mies.** + **~€59 VPS**/rok + **~€33** domena/rok (przeliczenia PLN według kursu).

---

## H. Deployment checklist (produkcja)

- [x] Repozytorium na GitHub z workflow deploy
- [x] Na VPS: Docker + `docker-compose.prod.yml`
- [x] Plik **`.env.production`** (sekrety, `DATABASE_URL`, `REDIS_URL`, klucze API)
- [x] **SSL** (Let’s Encrypt), automatyczny renew (cron certbot)
- [x] **nginx** — routing `/api` → backend, statyczny frontend
- [x] **Redis** z limitami pamięci i `allkeys-lru`
- [x] **Migracje Prisma** po wdrożeniu (`migrate deploy` / polityka zespołu)
- [x] **Backup** S3 + cron
- [x] **Monitoring** zewnętrzny

---

## I. Git — commity (Phase 7–9, ostatnie z `main`)

*Pełna historia:* `git log`. Poniżej **ostatnie commity z gałęzi** (stan lokalny — zaktualizuj po pushu):

```
d4b5f7e8 scripts: database backup to s3
74bd171c ci: verify ssh deployment
f410cecb ci: test deployment
c7d9f87e docs: production ready
0d1f2910 ci: github actions deployment workflow
29b5cd71 feat: enable HTTPS and redirect HTTP in nginx prod config
4585072d fix: route /api/health to backend health endpoint
...
```

**GitHub Actions:** [https://github.com/ApexPayGG/aplikacja-gielda/actions](https://github.com/ApexPayGG/aplikacja-gielda/actions)

---

## J. Next phases (Phase 10+)

| Temat | Opis |
|-------|------|
| Real dividend API | Podłączenie produkcyjnego feedu + normalizacja walut/kalendarza |
| ML: Dividend Sustainability Score | Model / reguły + UI |
| ML: Predictive changes | Prognoza zmian polityki dywidendy (dane + etykiety) |
| Telegram | Rozszerzenie komend o skróty dywidend / alerty ex-dividend |
| Paper trading / scoring | Zgodnie z roadmapą produktu (moduły 1–10) |

---

## K. Known issues

| Problem | Objaśnienie / mitigation |
|---------|---------------------------|
| **k6 `http_req_failed` ~5–7%** | Głównie **404** na `/api/quotes/:symbol` przy braku rekordu w DB — **scheduler / scraper dzienny** i spójny seed; ewentualnie zmiana checków k6 na oczekiwany status. |
| **Windows: Prisma `EPERM`** | Zablokowany `query_engine` — zamknij procesy (Node, IDE) przed `npx prisma generate`. |
| **PowerShell: `npm.ps1` zablokowany** | Użyj `npm.cmd run ...` lub `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`. |

---

## Instrukcja: deployment na produkcję (skrót)

1. **VPS:** Docker, Docker Compose, sklonuj repo (lub deploy przez Actions).
2. **Skopiuj** `.env.production` → `.env` na serwerze (lub użyj `env_file` w compose — jak w `docker-compose.prod.yml`).
3. **TLS:** certbot dla `stock-ai.pro`, ścieżki mount w nginx (jak w prod compose).
4. **Uruchomienie:**

```bash
docker compose -f docker-compose.prod.yml pull   # jeśli używasz registry
docker compose -f docker-compose.prod.yml up -d
```

5. **Migracje** (jednorazowo / po release):

```bash
docker exec -it stockai-api-prod npx prisma migrate deploy
```

6. Zweryfikuj: `https://stock-ai.pro/health` (lub endpoint skonfigurowany w nginx).

---

## Instrukcja: setup lokalny (developer)

**Wymagania:** Node 20, Docker (opcjonalnie Postgres + Redis lokalnie), Git.

1. Sklonuj repo, wejdź w `apps/api` i `apps/frontend`.

2. **API** — utwórz `apps/api/.env` (wzorzec: `apps/api/.env.example`):

   - `DATABASE_URL` — Postgres/Timescale lokalnie lub z `docker compose` z roota repo.
   - `REDIS_URL=redis://localhost:6379` (gdy Redis działa).

3. **Baza + seed:**

```bash
cd apps/api
npx prisma generate
npx prisma db push
npm run db:seed
```

4. **Uruchom API:**

```bash
npm run server
```

5. **Frontend:**

```bash
cd apps/frontend
npm install
npm run dev
```

6. **Load test (Docker + k6):** z `apps/api` — patrz `package.json` (`load:test:final:all`); na Windows przy problemach z PowerShell użyj **`npm.cmd`**.

---

## Komendy load test (referencja)

```bash
cd apps/api

# Baseline + eksport JSON
npm.cmd run load:test:baseline:export

# FINAL + eksport JSON
npm.cmd run load:test:final:export

# HTML + CSV porównawcze
npm.cmd run load:test:final:report

# Wszystko po kolei
npm.cmd run load:test:final:all
```

*API musi nasłuchiwać na porcie użytym w `BASE_URL` (domyślnie `http://host.docker.internal:3000` z kontenera k6 na Windows).*

---

*Koniec dokumentu FINAL BRIEF v1.9.0.*
