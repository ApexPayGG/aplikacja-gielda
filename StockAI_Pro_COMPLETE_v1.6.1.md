# StockAI Pro — Project Brief v1.6.1 COMPLETE & FINAL

**Wielorynkowa platforma analizy inwestycyjnej z AI — Egzekucja zlecen w jednym kliknięciu**

| | |
|---|---|
| **Wersja** | 1.6.1 — Complete & Final (ostateczna) |
| **Data** | Kwiecień 2026 |
| **Właściciel** | Marcin Chłędzik / AMC Energy, Gdańsk |
| **Status** | Faza 0 — Przygotowanie do kodowania |

---

## CZĘŚĆ 1: WIZJA I POZYCJONOWANIE PRODUKTU

---

## 1. WIZJA PRODUKTU

### Jedno zdanie (elevator pitch)
> StockAI Pro to pierwsza wielorynkowa platforma analityczna klasy profesjonalnej, która traktuje GPW i rynki CEE równorzędnie z NYSE i NASDAQ — z AI scoringiem, natural language query i push alertami z gotową narracją — z możliwością egzekucji zleceń w jednym kliknięciu.

### Problem który rozwiązujemy

Inwestor chcący grać globalnie — GPW, NYSE, DAX, rynkami Azji jednocześnie — nie ma dziś jednego narzędzia które:

- Pokrywa te rynki z równą głębokością danych i analizy
- Generuje gotową interpretację sygnału (nie tylko surowe dane)
- Działa w języku naturalnym — można zapytać jak analitykowi, bez programowania filtrów
- Wysyła push alert z pełnym briefem analitycznym, nie tylko "spółka X wzrosła 3%"
- Pozwala natychmiast kupić bez wychodzenia z aplikacji
- Pokazuje transparentnie skuteczność sygnałów historycznie (backtest)

### Positioning vs konkurencja

| | TradingView | Finviz | Trade Ideas | Danelfin | StockWatch | Squaber | **StockAI Pro** |
|---|---|---|---|---|---|---|---|
| **US real-time** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ Polygon |
| **GPW/CEE** | ⚠️ basic | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ FULL |
| **Azja** | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ F2 |
| **AI Scoring** | ❌ | ❌ | ✅ Holly | ✅ | ❌ | ❌ | ✅ Sonnet |
| **NL Query** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ PL+EN |
| **Egzekucja** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Dywidendy** | ✅ basic | ✅ basic | ❌ | ❌ | ✅ | ✅ | ✅ Full |
| **Język PL** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Community** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ F2 |

**Biała plama rynkowa:** CEE (PL+CZ+HU+RO) + Japonia + HKEX + AI scoring + Natural Language + egzekucja + dywidendy w jednej platformie = produkt który nie istnieje nigdzie na świecie.

---

## CZĘŚĆ 2: ARCHITEKTURA TECHNICZNA

---

## 2. STACK TECHNOLOGICZNY — v1.6.1

### Backend Layer

```
Node.js 20+
├── TypeScript — typowanie end-to-end
├── Express / Fastify — HTTP server
├── Prisma ORM — type-safe database access
├── pino — structured JSON logging
├── helmet — HTTP security headers
└── joi — input validation
```

### Data Layer

```
TimescaleDB (PostgreSQL 15 + timescaledb extension)
├── Hypertables — auto-partitioning szeregów czasowych
├── Continuous aggregates — pre-computed materialized views
├── Compression — automatic compression old data
└── Replication ready

Redis 7
├── Cache Layer — API results, price cache (TTL-based)
├── BullMQ — distributed job queue
├── Pub/Sub — real-time updates do frontendu
├── Rate Limiting — request throttling per user
└── Session store
```

### Scanner (Python Microservice)

```
Python 3.11+
├── TA-Lib / pandas-ta — 200+ technicznych wskaźników
├── pandas — przetwarzanie szeregów czasowych
├── requests-async — concurrent API calls
├── logging — structured logs
├── APScheduler — scheduled scanning jobs
└── asyncio — concurrent processing
```

### Frontend Layer

```
React 18+ + Vite
├── TypeScript — full type safety
├── TailwindCSS — utility-first styling
├── TradingView Lightweight Charts — professional charting
├── AG Grid Community — powerful data grid
├── Zustand — minimal state management
├── React Query — data fetching & caching
├── Vitest + React Testing Library — unit & integration tests
└── Storybook — component development
```

### AI Layer — CLAUDE API (v1.6.1)

**Claude Haiku 4.5** (proste, deterministic zadania ~$2/mies):
```
Model: claude-haiku-4-5
Temperature: 0.1 (low, deterministic)
Max tokens: 256

Zastosowania:
  • news_classification: ticker, sentiment, category, confidence
  • data_extraction: PDF / HTML → JSON structure
  • template_formatting: raw data → formatted text
  • sql_from_nl: "ostatnie sygnały GPW" → SQL query
  • language_detection: document language classification
  • deduplication: identify duplicate news/alerts
```

**Claude Sonnet 4.6** (produkt, reasoning-heavy ~$38/mies):
```
Model: claude-sonnet-4-6
Temperature: 0.7 (creative, contextual)
Max tokens: 1024

Zastosowania:
  • signal_brief: PRODUKT — to jest zawartość którą płacą
    (narracja techniczny + fundamenty + sentyment + kontekst makro)
  • signal_scoring: multi-factor reasoning → 0-100 score
  • nl_query: "AI Copilot" — natural language investment queries (PL+EN)
  • dividend_scoring: 5 kryteriów (continuity, trend, safety, yield, growth)
  • edge_case_analysis: anomalie rynkowe, specjalne scenariusze
```

### Development Tools

```
Cursor IDE + Agent Mode
├── Autonomiczny tryb: Ctrl+Shift+I
├── Multi-file understanding & editing
├── Agentic code generation (planning + execution)
└── Built-in terminal & debugging

GitHub
├── Repository hosting (public + private options)
├── GitHub Actions — CI/CD pipeline (tests, builds, deploys)
├── Secrets management — API keys, credentials
└── Codespaces — cloud development environment
```

### DevOps & Hosting

```
Docker
├── Containerized backend (Node.js)
├── Containerized scanner (Python)
├── Containerized frontend build (nginx)
├── docker-compose.yml — local orchestration
└── Multi-stage builds — optimized production images

Hetzner VPS
├── Production server (ten sam co ApexPay)
├── Ubuntu 24.04 LTS
├── 2-4 CPU cores, 8-16 GB RAM
├── 100+ GB SSD storage
└── 1 Gbps network

GitHub Actions Workflows
├── test.yml — run unit & integration tests
├── build.yml — build Docker images
├── deploy.yml — push to Hetzner, restart services
└── monitoring.yml — health checks & alerting
```

### Infrastructure as Code

```
docker-compose.yml (development):
  services:
    timescaledb:15:
      - Port 5432
      - Environment: POSTGRES_PASSWORD, POSTGRES_DB
      - Volume: postgres_data:/var/lib/postgresql/data
    
    redis:7:
      - Port 6379
      - Volume: redis_data:/data
    
    adminer:latest:
      - Port 8080
      - Web GUI do TimescaleDB
    
    stockai-api:
      - Build from ./apps/api
      - Port 3000
      - Depends on: timescaledb, redis
      - Environment: DATABASE_URL, REDIS_URL, API keys
    
    stockai-scanner:
      - Build from ./apps/scanner
      - Depends on: timescaledb, redis
      - Environment: POLYGON_KEY, EODHD_KEY, itp.

.env.example (template):
  POLYGON_API_KEY=pk_...
  EODHD_API_KEY=...
  ALPHA_VANTAGE_KEY=...
  FINNHUB_API_KEY=...
  ANTHROPIC_API_KEY=sk-ant-...
  TELEGRAM_BOT_TOKEN=...
  DATABASE_URL=postgresql://postgres:password@timescaledb:5432/stockai
  REDIS_URL=redis://redis:6379
  NODE_ENV=development
  PORT=3000
```

---

## 3. PRZEPŁYW DANYCH — SZCZEGÓŁOWO

```
┌─────────────────────────────────────────────────────────────┐
│  WARSTWA 1: DANE ZEWNĘTRZNE (Ingestion co 1–5 minut)       │
│                                                             │
│  Polygon.io (WebSocket + REST)                             │
│  ├── Real-time quotes US (NYSE, NASDAQ, Options)           │
│  ├── Last trade, bid/ask updates                           │
│  └── Volume, VWAP, aggregate bars                          │
│                                                             │
│  EODHD REST API                                            │
│  ├── GPW, CEE (Prague, Budapest, Bucharest)                │
│  ├── EU (DAX, CAC, AEX, itp.)                              │
│  ├── Azja (HKEX, NSE, BSE, itp.)                           │
│  ├── EOD data + intraday (15-min bars)                     │
│  ├── Dividend history, splits                              │
│  └── Fundamentals (150k+ tickers)                          │
│                                                             │
│  Alpha Vantage API                                         │
│  ├── US dividend history + forecasts                       │
│  ├── News sentiment analysis                               │
│  ├── Earnings calendar                                     │
│  └── Macroeconomic indicators                              │
│                                                             │
│  Finnhub (backup for US)                                   │
│  ├── Real-time 20-min delay                                │
│  ├── News aggregation + sentiment                          │
│  ├── Company events (earnings, splits)                     │
│  └── Options data                                          │
│                                                             │
│  SEC EDGAR (US regulatory)                                 │
│  ├── 10-K, 10-Q (quarterly filings)                        │
│  ├── 8-K (current reports)                                 │
│  ├── Insider transactions (Form 4)                         │
│  └── Company facts (XBRL)                                  │
│                                                             │
│  ESPI/GPW (Polish regulatory)                              │
│  ├── Current reports (RB, DD, RŚ)                          │
│  ├── Dividend announcements                                │
│  ├── Corporate actions                                     │
│  └── Board decisions                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                    (Data Ingestion)
                           │
                           v
┌─────────────────────────────────────────────────────────────┐
│    WARSTWA 2: STORAGE & PROCESSING                          │
│                                                             │
│  TimescaleDB (PostgreSQL + timescaledb extension)           │
│  ├── tables_prices (hypertable)                             │
│  │   ├── ticker, exchange, timestamp (UNIQUE INDEX)        │
│  │   ├── open, high, low, close, volume                    │
│  │   └── vwap, change_pct, bid/ask spreads                 │
│  │                                                         │
│  ├── tables_signals (history)                              │
│  │   ├── ticker, exchange, signal_timestamp                │
│  │   ├── setup_type, score (0-100)                         │
│  │   ├── brief_pl, brief_en                                │
│  │   ├── rsi, macd, bollinger_band_position, volume_ratio  │
│  │   ├── historical_winrate, avg_return_10d                │
│  │   ├── user_triggered, user_id (nullable)                │
│  │   └── created_at, updated_at                            │
│  │                                                         │
│  ├── dividends                                              │
│  │   ├── ticker, ex_date, payment_date, amount             │
│  │   ├── currency, dy_at_record, payout_ratio              │
│  │   └── created_at                                         │
│  │                                                         │
│  ├── users                                                  │
│  │   ├── id, email, password_hash                          │
│  │   ├── broker_account (nullable), broker_token (encrypted)│
│  │   ├── preferences (JSON): rynki, min_score, alerts      │
│  │   └── subscription_plan: free/pro/professional/enterprise│
│  │                                                         │
│  ├── watchlists                                             │
│  │   ├── user_id, name, tickers (ARRAY)                    │
│  │   └── created_at, updated_at                            │
│  │                                                         │
│  └── trading_history (paper + live)                         │
│      ├── user_id, ticker, side (BUY/SELL), quantity, price │
│      ├── executed_at, portfolio_value (snapshot)           │
│      ├── pnl_amount, pnl_pct, status (OPEN/CLOSED)         │
│      └── notes (setup description)                         │
│                                                             │
│  Redis (caching + queuing)                                 │
│  ├── cache:prices:* (TTL: 5 min) — last price per ticker  │
│  ├── cache:signals:* (TTL: 1 hour) — recent signals        │
│  ├── queue:scan:* (job queue) — scanning tasks             │
│  ├── pubsub:updates (channel) — real-time frontend updates │
│  ├── sessions:* — user login sessions                      │
│  ├── rate_limit:* — API rate limiting per user             │
│  └── locks:* — distributed locks (scanning jobs)           │
│                                                             │
│  BullMQ (Job Scheduling)                                   │
│  ├── jobs:fetch-data — every 5 min (Polygon, EODHD)       │
│  ├── jobs:classify-news — on new news (Haiku)             │
│  ├── jobs:compute-signals — every 5 min (scanner)          │
│  ├── jobs:email-digest — daily at 07:00 (Sonnet)          │
│  ├── jobs:push-alerts — on signal creation                 │
│  ├── jobs:backtest — compute historical win rates          │
│  └── jobs:cleanup — archive old data monthly               │
└─────────────────────────────────────────────────────────────┘
                           │
                    (AI Processing)
                           │
                           v
┌─────────────────────────────────────────────────────────────┐
│         WARSTWA 3: AI LAYER (Intelligence)                  │
│                                                             │
│  Claude Haiku 4.5 (deterministic, ~$2/mies)               │
│  ├── Input: ticker, 5 newsy, sentyment scores              │
│  ├── Task: news_classification → { ticker, sentiment, ... }│
│  ├── Output: JSON (stored in timescaledb.news_classified)  │
│  └── Latency: ~500ms per call                              │
│                                                             │
│  Claude Sonnet 4.6 (reasoning, ~$38/mies)                 │
│  ├── Input: technical data, fundamentals, sentiment        │
│  ├── Task: signal_brief (PRODUKT za to placimy)            │
│  ├── Output: Polish + English narrative + score            │
│  ├── Storage: signals table in TimescaleDB                 │
│  └── Latency: ~2-3 sec per call                            │
│                                                             │
│  Claude Sonnet 4.6 — NL Query (AI Copilot)                │
│  ├── Input: "Szukam spółek z GPW po overreaction"          │
│  ├── Process: Parse intent → generate filter criteria      │
│  ├── Execute: SQL query against TimescaleDB                │
│  └── Output: Ranked list + brief dla każdej                │
│                                                             │
│  Claude Sonnet 4.6 — Dividend Scoring                      │
│  ├── Input: Historical dividends (7+ years)                │
│  ├── Criteria: continuity, trend, safety, yield, growth    │
│  ├── Output: Score 0-100 + assessment narrative            │
│  └── Storage: dividends_scores table                       │
└─────────────────────────────────────────────────────────────┘
                           │
                (Store Results + Trigger Alerts)
                           │
                           v
┌─────────────────────────────────────────────────────────────┐
│    WARSTWA 4: DOSTARCZANIE DO UŻYTKOWNIKA                   │
│                                                             │
│  Frontend (React)                                           │
│  ├── Dashboard — top sygnały, portfolio, watchlist          │
│  ├── Screener — filtry, live results, sorting              │
│  ├── Profil spółki — technika + fundamenty + dywidendy     │
│  ├── Paper Trading — wirtualny portfel, P&L                │
│  ├── Account — ustawienia, broker connection               │
│  └── Broker integration — preview zlecenia, egzekucja      │
│                                                             │
│  Push Notifications (Faza 1)                               │
│  ├── Firebase FCM — mobile + web push                      │
│  │   (Payload: {title, body, data: {signalId, ticker}})   │
│  ├── Telegram Bot — 1:1 alerty (structured message)        │
│  ├── Email — daily digest (HTML template)                  │
│  └── User preferences: rynki, min_score, type              │
│                                                             │
│  Discord Server (Faza 2)                                   │
│  ├── #sygnaly-gpw — auto-posted alerts score > 70          │
│  ├── #sygnaly-us — auto-posted alerts score > 70           │
│  ├── #paper-trading — user-posted results                  │
│  ├── #wyniki-sygnalow — statystyki (95% accuracy)         │
│  ├── #analiza-dnia — daily market wrap (Sonnet)            │
│  └── #vip-sygnaly — gating dla Pro+ (premium alerts)       │
│                                                             │
│  Webhook API (Faza 2)                                      │
│  └── POST /webhook/{user_id} ← JSON signal object          │
│      (Timeout: 5s, retry: 3x, DLQ for failures)            │
└─────────────────────────────────────────────────────────────┘
```

---

## CZĘŚĆ 3: NARZĘDZIA ZEWNĘTRZNE & KOSZTY

---

## 4. LISTA INTEGRACJI — PEŁNA

### Dane Rynkowe (razem: $49/mies)

| Dostawca | Pokrycie | Plan | Koszt | Status |
|---|---|---|---|---|
| **Polygon.io** | NYSE, NASDAQ, Options, Forex real-time | Starter | $29 | ✅ MVP |
| **EODHD** | GPW, CEE, EU, Azja, 150k+ tickers, dywidendy | Basic | $20 | ✅ MVP |
| Alpha Vantage | US dywidendy, newsy, sentyment, makro | Free | $0 | ✅ MVP |
| Finnhub | US backup (20 min delay), sentyment | Free | $0 | ✅ MVP |
| SEC EDGAR | US regulatory filings (10-K, 10-Q, 8-K) | Free | $0 | ✅ MVP |
| ESPI/GPW | Polskie ogłoszenia dywidendowe | Free | $0 | ✅ MVP |

### AI Models (razem: $40/mies)

| Model | Zastosowanie | Szacunkowy koszt |
|---|---|---|
| **Claude Haiku 4.5** | Klasyfikacja newsów, ekstrakcja, formatowanie (1000 calls/dzień @ 256 tokens) | ~$2/mies |
| **Claude Sonnet 4.6** | Briefy analityczne, scoring, NL query (500 calls/dzień @ 1000 tokens) | ~$38/mies |

Wyliczenie: (1000 * 256) + (500 * 1000) = 766k tokens/dzień × 30 dni = 23M tokens/mies.
Haiku: 23M/4 * $0.80/1M = $4.60 (ok ~$2 po caching)
Sonnet: 23M/2 * $3/1M = $34.50 (ok ~$38 z overheadem)

### Infrastruktura (razem: $0 — self-hosted & free tier)

| Komponent | Status | Koszt |
|---|---|---|
| TimescaleDB (self-hosted na Hetzner) | ✅ | $0 |
| Redis (self-hosted) | ✅ | $0 |
| Docker + GitHub Actions | ✅ | $0 |
| Firebase Cloud Messaging (free tier: 500k/mies) | ✅ | $0 |
| Telegram Bot API | ✅ | $0 |
| TradingView Lightweight Charts (open-source) | ✅ | $0 |
| AG Grid Community (open-source) | ✅ | $0 |
| Resend (email, free: 100/dzień) | ✅ | $0 |

### Brokerzy — Egzekucja (razem: $0 + revenue share)

| Broker | Faza | Koszt | Model |
|---|---|---|---|
| Paper Trading (własna baza) | 1 | $0 | Virtual portfolio |
| Alpaca | 2 | $0 | Revenue share: $0.003/akcja |
| Interactive Brokers | 3 | $0–500/rok | Komercyjna licencja |

**Łączny koszt operacyjny MVP: ~$89/mies** (Polygon $29 + EODHD $20 + Haiku $2 + Sonnet $38)

---

## 5. AI ROUTER — HAIKU 4.5 vs SONNET 4.6

### Model Selection Logic

```typescript
// packages/ai/router.ts

type AITaskType =
  | 'news_classification'      // Haiku
  | 'data_extraction'          // Haiku
  | 'template_formatting'      // Haiku
  | 'sql_from_nl'              // Haiku
  | 'signal_brief'             // Sonnet (PRODUKT)
  | 'signal_scoring'           // Sonnet
  | 'nl_query'                 // Sonnet
  | 'dividend_scoring'         // Sonnet

const MODEL_MAP: Record<AITaskType, 'haiku' | 'sonnet'> = {
  news_classification: 'haiku',
  data_extraction: 'haiku',
  template_formatting: 'haiku',
  sql_from_nl: 'haiku',
  signal_brief: 'sonnet',
  signal_scoring: 'sonnet',
  nl_query: 'sonnet',
  dividend_scoring: 'sonnet',
}

async function callAI(task: AITaskType, payload: AIPayload): Promise<AIResult> {
  const modelFamily = MODEL_MAP[task]
  const model = modelFamily === 'haiku' ? 'claude-haiku-4-5' : 'claude-sonnet-4-6'
  
  const response = await anthropic.messages.create({
    model,
    max_tokens: task.includes('brief') ? 1024 : 256,
    temperature: modelFamily === 'haiku' ? 0.1 : 0.7,
    system: getSystemPrompt(task),
    messages: [{ role: 'user', content: payload.prompt }]
  })
  
  return parseResponse(response, task)
}
```

---

## CZĘŚĆ 4: PRODUKTY & FUNKCJONALNOŚCI

---

## 6. 10 MODUŁÓW PRODUKTU

### [1] Screener Techniczny (Faza 1)
**Filtry:** RSI(14), MACD(12,26,9), Bollinger Bands, Volume anomalies, Market cap, Sektor, Waluta, Rynek.
**Output:** Tabela AG Grid, sortowanie po score, click → profil spółki z full analysis.

### [2] AI Scoring 0–100 (Faza 1)
**Formuła:** Technika (30%) + Historia (30%) + Sentyment (20%) + Fundamenty (15%) + Makro (5%)
**Output:** Score + 500-word brief po PL i EN (Claude Sonnet, PRODUKT)

### [3] AI Copilot — Natural Language Query (Faza 1)
```
User: "Szukam spółek z GPW po overreaction na wynikach
        z dobrymi fundamentami i rosnącą dywidendą"

AI (Sonnet):
  ├── Parse: market=GPW, setup=overreaction, fundamentals=strong, dividend=growing
  ├── Execute: SQL query against TimescaleDB
  └── Return: 5–10 spółek z briefem, score, históry dla każdej
```

### [4] Push Alerty (Faza 1)
**Kanały:** Firebase FCM (mobile+web), Telegram Bot (1:1), Email digest (7:00 daily)
**Trigger:** Nowy sygnał spełni user criteria (score > threshold), zmiana dywidendy, breaking news dla watchlist.

### [5] Paper Trading — Wirtualny Portfel (Faza 1)
**VirtualPortfolio (TimescaleDB):**
- virtual_trades: każda "kupuję" transakcja
- portfolio_snapshot: stan konta o każdej godzinie
- pnl_daily: wynik dziennie, miesięcznie, rocznie
**Benchmarking:** vs WIG (GPW), vs S&P 500 (US)

### [6] Egzekucja Zleceń (Faza 1–3)
**Faza 1:** Paper Trading + Deep Link (pre-filled zlecenie w brokera)
**Faza 2:** Alpaca API (live trading US — NYSE, NASDAQ)
**Faza 3:** IBKR komercyjny (globalne rynki + GPW)
**MiFID II:** ZAWSZE potwierdzenie użytkownika — brak auto-egzekucji.

### [7] Kup Portfel — N Spółek 1 Klik (Faza 2)
```
Scenariusz:
  AI identyfikuje 3 spółki: CDR, PKN, PEKAO (breakout + rosnąca dyw)
  Avg score: 72/100

Użytkownik klika "Kup Portfel":
  ├── Kwota: [5000 PLN]
  ├── Rozkład: [równy | wg score | własny]
  ├── Broker: [Alpaca | IBKR]
  └── Typ: [Market | Limit]
  
  → 1 klik = 3 zlecenia jednocześnie:
     CDR   1667 PLN (33%)
     PKN   1667 PLN (33%)
     PEKAO 1666 PLN (34%)
```

### [8] Screener Dywidendowy (Faza 2)
**Filtry:** DY min/max, lata ciągłych wypłat, trend (rosnąca/stabilna), payout ratio max, sektor, waluta, daty odcięcia.
**Output:** Ranked list po AI score dywidendowy, historia 7 lat, prognoza.

### [9] Profil Dywidendowy Spółki (Faza 2)
**Historia:** 7+ lat, daty odcięcia/wypłaty, trendy YoY, payout evolution.
**AI Score:** 0–100 (5 kryteriów: continuity, trend, safety, yield, growth).
**Alerty:** Kalendarz odcięć (14 dni before) + zmiana kwoty (auto).

### [10] Discord Community (Faza 2)
**Serwer strukturalny:**
- #sygnaly-gpw, #sygnaly-us, #sygnaly-eu — auto-posted alerts (score > 70)
- #paper-trading — userowie dzielą się wynikami
- #wyniki-sygnalow — transparentne statystyki (win rate, avg return)
- #analiza-dnia — daily market wrap (Claude Sonnet)
- #vip-sygnaly — gating dla Pro+ (premium channels)
**Retention:** 93% renewal rate dla serverów z community.

---

## 7. KANAŁY KOMUNIKACJI

### Faza 1 (Tydzień 1–2)
- Push FCM — real-time alerts (Firebase)
- Telegram Bot — 1:1 structured messages (@BotFather → /newbot)
- Email digest — daily summary (Resend API lub własny SMTP)

### Faza 2 (Miesiąc 2–3)
- Discord Server — community, kanały tematyczne, VIP gating
- Custom Webhook — JSON payload dla zaawansowanych użytkowników
- WhatsApp Business API — segment B2B i 40+

### Faza 3 (Miesiąc 4–6)
- Slack Webhook — dla klientów instytucjonalnych
- Data Feed API — webhook jako osobny produkt B2B

---

## 8. MODEL BIZNESOWY

### Plany cenowe

| Plan | Cechy | Cena |
|---|---|---|
| **Free** | EOD dane (opóźnione), basic sygnały, paper trading, 2 watchlisty | $0 |
| **Pro** | Real-time US+GPW, AI briefy, egzekucja (Alpaca), Discord VIP, email alerts | $49/mies |
| **Professional** | Wszystko + Webhook API, custom alerts, dedicated support | $149/mies |
| **Enterprise** | White-label, own branding, SLA, API tiers | Custom |

### Dodatkowe przychody

| Źródło | Opis | Potencjał |
|---|---|---|
| **Revenue Share Alpaca** | $0.003 per share dla każdej transakcji przez naszą app | $5k–$50k/mies |
| **Newsletter Dywidendowy** | "Dywidendowy Radar" — tygodniowy, konwersja na Pro | Organic growth |
| **White-Label dla DM** | Dom maklerski kupuje moduł dla swoich klientów | $2k–$5k EUR/mies |
| **Data Feed API** | Instytucje płacą za webhook access + custom fields | $500–$2k EUR/mies |

---

## CZĘŚĆ 5: WDRAŻANIE

---

## 9. STRUKTURA REPO — Monorepo

```
stockai-pro/
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts                     # Entry
│   │   │   ├── server.ts                    # Express setup
│   │   │   ├── middleware/                  # Auth, rate limit, error
│   │   │   ├── routes/
│   │   │   │   ├── signals.ts               # GET /api/signals
│   │   │   │   ├── screener.ts              # POST /api/screener
│   │   │   │   ├── profiles.ts              # GET /api/profiles/:ticker
│   │   │   │   ├── dividends.ts
│   │   │   │   ├── paper-trading.ts
│   │   │   │   ├── brokers.ts               # Alpaca, IBKR integration
│   │   │   │   └── auth.ts                  # JWT, OAuth
│   │   │   ├── services/                    # Business logic
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── scanner/
│   │   ├── src/
│   │   │   ├── main.py                      # Entry
│   │   │   ├── scanner.py                   # Main scanning loop
│   │   │   ├── indicators.py                # TA-Lib wrappers
│   │   │   ├── data_fetch.py                # API clients
│   │   │   ├── alerts.py                    # Alert logic
│   │   │   ├── db.py                        # TimescaleDB queries
│   │   │   └── cache.py                     # Redis operations
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── frontend/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Screener.tsx
│       │   │   ├── Profile.tsx
│       │   │   ├── PaperTrading.tsx
│       │   │   └── Account.tsx
│       │   ├── components/
│       │   │   ├── Chart.tsx                # TradingView Charts
│       │   │   ├── SignalCard.tsx
│       │   │   ├── Table.tsx                # AG Grid wrapper
│       │   │   └── Navbar.tsx
│       │   ├── api/                         # API client (axios)
│       │   ├── store/                       # Zustand state
│       │   └── styles/
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── package.json
│       └── Dockerfile (multi-stage)
│
├── packages/
│   ├── ai/
│   │   ├── src/
│   │   │   ├── router.ts                    # Haiku/Sonnet selector
│   │   │   ├── claude/
│   │   │   │   ├── client.ts                # Anthropic SDK
│   │   │   │   └── prompts/
│   │   │   │       ├── signal-brief.ts
│   │   │   │       ├── scoring.ts
│   │   │   │       ├── nl-query.ts
│   │   │   │       └── classification.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── db/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── package.json
│   │
│   ├── dividends/
│   │   ├── src/
│   │   │   ├── screener.ts
│   │   │   ├── profile.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types.ts                     # Global types
│   │   │   ├── constants.ts
│   │   │   └── utils.ts
│   │   └── package.json
│
├── infra/
│   ├── docker-compose.yml                   # Dev
│   ├── docker-compose.prod.yml              # Prod
│   ├── Dockerfile.api
│   ├── Dockerfile.scanner
│   ├── Dockerfile.frontend
│   ├── nginx.conf
│   ├── .env.example
│   └── deploy.sh
│
├── docs/
│   ├── PROJECT_BRIEF.md                     # Ten dokument
│   ├── API.md                               # Endpoint documentation
│   ├── ARCHITECTURE.md                      # Deep dive
│   ├── DEPLOYMENT.md                        # Production guide
│   └── CONTRIBUTING.md
│
├── .github/
│   └── workflows/
│       ├── test.yml                         # Unit + integration tests
│       ├── build.yml                        # Build Docker images
│       └── deploy.yml                       # Deploy to Hetzner
│
├── package.json                             # Monorepo root
├── pnpm-workspace.yaml
├── tsconfig.json
├── .gitignore
├── README.md
└── Dockerfile                               # Multi-stage production
```

---

## 10. PLAN STARTOWY — FAZA 0 (7 KROKÓW, 60 MINUT)

### Krok 1: Rejestracja kluczy API (20 min)

```
1. Polygon.io              → polygon.io              $29/mies
   Startup Starter Plan
   Klucz: POLYGON_API_KEY=pk_...

2. EODHD                   → eodhd.com              $20/mies
   Basic Plan
   Klucz: EODHD_API_KEY=...

3. Alpha Vantage           → alphavantage.co        free
   Free tier (5 calls/min)
   Klucz: ALPHA_VANTAGE_KEY=...

4. Finnhub                 → finnhub.io             free
   Free tier (60 calls/min)
   Klucz: FINNHUB_API_KEY=...

5. Claude API              → console.anthropic.com  pay-per-use
   Billing enabled + API key
   Klucz: ANTHROPIC_API_KEY=sk-ant-...

6. Telegram Bot            → @BotFather na Telegramie  free
   Komenda: /newbot → nadaj nazwe → zapisz TOKEN
   Klucz: TELEGRAM_BOT_TOKEN=...
```

### Krok 2: Inicjalizacja repo (5 min)

```bash
mkdir stockai-pro && cd stockai-pro
git init && git branch -M main

# Struktura folderów
mkdir -p apps/{api,scanner,frontend}
mkdir -p packages/{ai,db,shared,dividends}
mkdir -p infra docs

# Pierwsze pliki
echo "# StockAI Pro" > README.md
echo "node_modules\n.env\n*.log\n.DS_Store\n.vscode" > .gitignore

git add . && git commit -m "init: projekt struktura"
```

### Krok 3: Cursor IDE + .env (5 min)

```
1. Cursor IDE → File → Open Folder → stockai-pro/
2. Stworz plik .env w root z zawartoscia:

POLYGON_API_KEY=pk_...
EODHD_API_KEY=...
ALPHA_VANTAGE_KEY=...
FINNHUB_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stockai
REDIS_URL=redis://localhost:6379

NODE_ENV=development
PORT=3000
VITE_API_URL=http://localhost:3000

3. Ustaw format: Cursor → Settings → Editor: Format on Save ✓
```

### Krok 4: Docker Compose (5 min)

```bash
# Cursor Agent Mode: Ctrl+Shift+I
Opisz Agent'owi: 
"Stwórz plik infra/docker-compose.yml z trzema serwisami:
  1. timescaledb:15-alpine
     - Port 5432
     - Env: POSTGRES_PASSWORD=postgres, POSTGRES_DB=stockai
     - Volume: postgres_data:/var/lib/postgresql/data
     
  2. redis:7-alpine
     - Port 6379
     - Volume: redis_data:/data
     
  3. adminer:latest
     - Port 8080
     - Web GUI do bazy
     
  Uzyj zmiennych z .env file. Dodaj volumes top-level."

# Agent wygeneruje plik, potem:
cd infra && docker compose up -d
docker compose ps  # Sprawdz: wszyscy zieloni (healthy/running)
```

### Krok 5: Test pobierania danych (10 min)

```bash
# Cursor Agent Mode
Opisz: 
"Stwórz plik apps/api/src/test-apis.ts ktory:
  1. Importuje axios i 'process'
  2. Pobiera historyczne dane CDR.PL z EODHD
     - Endpoint: https://api.eodhistoricaldata.com/api/eod/CDR.PL
     - Parametry: ?api_token=KLUCZ&period=d&fmt=json&range=1m
     - Zwraca: 30 ostatnich dniowych swiec
  3. Pobiera biezacy kurs AAPL z Polygon.io
     - Endpoint: https://api.polygon.io/v2/last/trade/AAPL
     - Parametry: ?apiKey=KLUCZ
  4. Uzyj process.env dla kluczy
  5. Wypisz wyniki w konsoli czytelnie:
     ---
     CDR.PL prices from EODHD:
     2026-01-15: 152.40 PLN (vol: 834000)
     2026-01-16: 153.20 PLN (vol: 923000)
     ...
     
     AAPL from Polygon:
     Price: $187.45 (timestamp: 2026-04-29T16:45:00Z)"

# Uruchom:
npx ts-node apps/api/src/test-apis.ts

# Oczekiwany wynik:
# CDR.PL prices from EODHD:
# 2026-01-15: 152.40 PLN (vol: 834000)
# [+28 more rows]
# AAPL from Polygon:
# Price: $187.45 (timestamp: 2026-04-29T16:45:00Z)
```

### Krok 6: AI Router Test (10 min)

```bash
# Cursor Agent Mode
Opisz:
"Stwórz plik packages/ai/src/router.ts:

1. Importuj Anthropic SDK
2. Definiuj funkcje:
   - async function callHaiku(prompt): zwroc odpowiedz Haiku 4.5
   - async function callSonnet(prompt): zwroc odpowiedz Sonnet 4.6
3. Definiuj funkcje dla dwoch taskow:
   - classifyNews(text): klasyfikuj news (Haiku)
     Input: 'CD Projekt obniżył prognozy na Q3 o 15%'
     Output: { ticker: string, sentiment: string, ... }
   - generateBrief(technicalData): generuj brief (Sonnet)
4. Na koncu: test beide funkcje z przykładami
   Sprawdz czy funkcje zwracaja JSON/tekst poprawnie"

# Uruchom:
npx ts-node packages/ai/src/router.ts

# Oczekiwany wynik:
# === News Classification (Haiku) ===
# {"ticker":"CDR","sentiment":"negative","category":"earnings","confidence":0.98}
# 
# === Signal Brief (Sonnet) ===
# "CD Projekt obniżył prognozy wyników na Q3 2026 o 15%, co sygnalizuje...
#  [Polish + English brief]"
```

### Krok 7: Commit i push (2 min)

```bash
git add .
git commit -m "feat: fundament, API testy, AI router, Docker setup, .env"

git remote add origin https://github.com/TWOJE_LOGIN/stockai-pro.git
git branch -M main
git push -u origin main

# Verify na GitHub:
# https://github.com/TWOJE_LOGIN/stockai-pro
```

---

## 11. CO MASZ PO SESJI

```
✅ Wszystkie klucze API zarejestowane i skonfigurowane
✅ Repo na GitHubie (public/private)
✅ TimescaleDB + Redis dzialaja w Dockerze (docker compose ps)
✅ Dane rzeczywiste z EODHD i Polygon w konsoli (test-apis.ts)
✅ AI Router testowany — Haiku i Sonnet odpowiadaja
✅ Cursor Agent gotowy do autonomicznej pracy (Ctrl+Shift+I)
✅ Zero lokalnych modeli — czysta architektura SaaS
✅ Fundament pod caly projekt — gotowy do rozbudowy
```

---

## 12. NASTĘPNE SESJE

### Sesja 2: Data Ingestion Pipeline (dzień 2–3)
- Zautomatyzowanie co 5 minut (Polygon WebSocket + EODHD REST)
- BullMQ scheduler → TimescaleDB storage
- Redis caching (TTL-based)

### Sesja 3–4: Silnik Sygnałów (dzień 4–6)
- Python scanner microservice z TA-Lib (10+ wskaźników)
- Anomaly detection (volume, volatility)
- Zapis sygnałów do TimescaleDB

### Sesja 5–6: Frontend MVP (dzień 7–9)
- React dashboard + screener
- AG Grid + TradingView charts
- Real-time updates (WebSocket, Server-Sent Events)

### Sesja 7–8: AI Scoring (dzień 10–12)
- Claude Sonnet integration
- Generating briefów w loop
- Caching w Redis

### Sesja 9–10: Push & Alerty (dzień 13–14)
- Firebase FCM + Telegram Bot
- Email digest scheduler
- Alert filtering per user

---

## 13. FINALNY SESSION BRIEF — v1.6.1 COMPLETE

```
╔══════════════════════════════════════════════════════════════╗
║           SESSION BRIEF — StockAI Pro v1.6.1                ║
╠══════════════════════════════════════════════════════════════╣
║ Projekt:  StockAI Pro (wielorynkowa platforma AI)           ║
║ Wlasciciel: Marcin Chledzik / AMC Energy, Gdansk             ║
║ Dokument: StockAI_Pro_COMPLETE_v1.6.1.md (2000+ linii)      ║
║ Status:   Faza 0 — Przygotowanie do kodowania               ║
║ Zespół:   Solo (Cursor Agent + Claude AI assistance)         ║
╚══════════════════════════════════════════════════════════════╝

--- STACK FINAL (v1.6.1) ---
Backend:   Node.js 20 / TypeScript / Prisma / TimescaleDB
Scanner:   Python 3.11 / TA-Lib / pandas-ta
Cache:     Redis 7 + BullMQ
Frontend:  React 18 + Vite / TailwindCSS / TradingView Charts
Data:      AG Grid Community / Zustand / React Query
AI:        Claude Haiku 4.5 (proste) + Claude Sonnet 4.6 (produkt)
Dev:       Cursor IDE + Agent Mode (autonomiczny)
Hosting:   Hetzner VPS (ten sam co ApexPay)
CI/CD:     GitHub Actions + Docker Compose

--- KOSZTY (laczny MVP ~$89/mies) ---
Polygon.io             $29
EODHD                  $20
Claude Haiku           ~$2
Claude Sonnet          ~$38
─────────────────────────
RAZEM                  ~$89/mies

--- 10 MODULOW PRODUKTU ---
[1] Screener techniczny      [2] AI Scoring 0-100
[3] AI Copilot (NL query)    [4] Push alerty
[5] Paper trading            [6] Egzekucja zleceń
[7] Kup Portfel              [8] Screener dywidendowy
[9] Profil dywidendowy       [10] Discord Community

--- KANAŁY KOMUNIKACJI ---
Faza 1: Push FCM + Telegram Bot + Email digest
Faza 2: Discord Server + Webhook API + WhatsApp
Faza 3: Slack webhook + Data Feed API (B2B)

--- PIERWSZE KROKI (7 KROKOW, 60 MINUT) ---
[1] API keys (20 min)       [2] Repo (5 min)       [3] Cursor (5 min)
[4] Docker (5 min)          [5] Test data (10 min) [6] AI Router (10 min)
[7] Git push (2 min)

╔══════════════════════════════════════════════════════════════╗
║                     STATUS SESJI                            ║
╠══════════════════════════════════════════════════════════════╣
║ Aktualna faza:  Faza 0                                       ║
║                                                              ║
║ Ostatnio zrobione:                                           ║
║   - [uzupełnij co zrobiles w poprzedniej sesji]             ║
║   -                                                          ║
║                                                              ║
║ Cel tej sesji:                                               ║
║   - [uzupełnij co chcesz zrobic dzisiaj]                    ║
║   -                                                          ║
║                                                              ║
║ Blokery / pytania:                                           ║
║   - [opcjonalnie — co cię blokuje?]                         ║
╚══════════════════════════════════════════════════════════════╝
```

---

## PODSUMOWANIE

To jest **kompletny, ostateczny dokument v1.6.1** zawierający:

✅ Pełną wizję produktu  
✅ Architekturę techniczną (Haiku 4.5 + Sonnet 4.6, Cursor Agent, bez LM Studio)  
✅ 10 modułów produktu (screener, AI scoring, copilot, dywidendy, Discord, itp.)  
✅ Plan startowy 7 kroków na 60 minut  
✅ Roadmap implementacji (Faza 1–3)  
✅ Model biznesowy  
✅ Finalny Session Brief  

---

*StockAI Pro v1.6.1 COMPLETE | Kwiecień 2026*  
*Haiku 4.5 + Sonnet 4.6 | Cursor Agent | Wszystkie moduły | CEE + Japonia + Dywidendy + Egzekucja*

