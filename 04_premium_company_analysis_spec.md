# Premium Company Analysis — Specyfikacja v1.0

> **StockAI Pro — flagowa funkcja analizy spółki**
> Cinematic Stock Analysis: 5 ekranów, 2.5 minuty, "wow factor"
> Stan obecny: 80% komponentów istnieje, brakuje warstwy łączącej
> Cel: dedykowana strona `/company/[ticker]/premium` która integruje wszystko + 5 nowych elementów

---

## Filozofia produktu

Każdy konkurent pokazuje DATA. Ten moduł pokazuje **INSIGHT, NARRATIVE i PERSONAL FIT**.

**5 zasad projektowych:**

1. **Verdict-first, data-second.** Decyzja na ekranie 1, dane na żądanie.
2. **Personalizacja jako moat.** Twój Trader Psyche profile + Decision Log generuje Personal Fit Score którego nie ma żadna inna platforma.
3. **Historie, nie tabele.** AI generuje 3-aktową narrację per spółka, nie generyczny summary.
4. **Brutalna prawda jako feature.** Sekcja "What's the Catch" pokazuje rzecz której inni unikają.
5. **Progressive disclosure.** Każdy ekran ~30 sek, advanced data głębiej dla tych co chcą.

---

## Struktura URL i nawigacja

```
Obecne: /company/[ticker]                  → CompanyDetail.tsx (basic)
Nowe:   /company/[ticker]/premium          → PremiumCompanyAnalysis.tsx (flagship)
```

**Entry points:**
- Z `CompanyDetail` button: "Otwórz Premium Analysis" (CTA upgrade jeśli free)
- Ze `SignalsPage` przy każdym sygnale: "Pełna analiza →"
- Z `Watchlist` long-press: "Premium Analysis"
- Search bar global: po wybraniu spółki domyślnie premium dla Pro+ userów

**Tier gating:**
- **Free:** widzi Ekran 1 (Verdict) + zablokowane 2-5 z teaserem "Otwórz pełną analizę (Pro)"
- **Pro:** Ekrany 1-4 (bez Personal Fit Score — wymaga zaawansowanego Psyche profile)
- **Pro+:** Wszystkie 5 ekranów + Pre-Mortem button + Mirror Trade z tej analizy

---

## EKRAN 1: VERDICT (5 sekund do decyzji)

### Cel
User w 5 sekund wie: **co kupić, po ile, kiedy sprzedać**. Cała reszta opcjonalna.

### Layout (mobile-first)

```
┌─────────────────────────────────────┐
│ ← AAPL · Apple Inc.            ⭐ ⋮ │
│ Technology · USA · $187 (+1.2%)     │
├─────────────────────────────────────┤
│                                     │
│         ╭──────────╮                │
│         │          │                │
│         │    73    │  ← gigantyczny  │
│         │   /100   │  (font 96px)   │
│         │          │                │
│         ╰──────────╯                │
│                                     │
│           ▼ BUY ▼                   │
│                                     │
│  Cena entry:    $187 (now) – $192   │
│  Target 12m:    $215 (+15%)         │
│  Stop loss:     $156 (-17%)         │
│  R/R ratio:     1:0.9 ✓             │
│  Horyzont:      12-18 miesięcy      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   📖 Pokaż pełną analizę    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  Kup teraz  │ │ Set alert   │   │
│  └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

### Logika Verdict Score (0-100)

**Kompozyt z 5 dimensji (każda 0-20 pkt):**

```typescript
verdictScore = 
  valuationHealth (0-20) +       // P/E vs history/peers
  financialStrength (0-20) +     // debt, FCF, margins trend
  growthQuality (0-20) +         // revenue/EPS trajectory + sustainability
  technicalPosition (0-15) +     // not chasing top, momentum aligned
  analystConsensus (0-15) +      // Buy/Hold split + recent revisions
  bonus (0-10);                  // catalysts, insider buys, etc.

verdictLabel = 
  if score >= 81: "STRONG BUY"
  if score >= 61: "BUY"
  if score >= 41: "HOLD"
  if score >= 21: "SELL"
  else: "STRONG SELL"
```

**Verdict to deterministyczny composite, NIE AI-generated.** AI używamy tylko do narracji (ekrany 3-5).

### Target / Stop logic

```typescript
target12m = 
  if score >= 81: currentPrice * 1.25  // +25%
  if score >= 61: currentPrice * 1.15  // +15%
  if score >= 41: currentPrice * 1.05  // +5%
  else: currentPrice * 0.95            // -5%

stopLoss = currentPrice * (1 - volatility30d * 1.5)
// gdzie volatility30d to 30-dniowa standardowa deviation
```

### Endpoint

```
GET /api/v1/company/:ticker/verdict
Response: {
  ticker: string,
  score: number,
  label: string,
  components: {
    valuation: { score, raw: { pe, peSector, peHistory5y } },
    financial: { score, raw: { debt, fcf, marginTrend } },
    growth: { score, raw: { revYoY, epsYoY, sustainability } },
    technical: { score, raw: { rsi, ma200, distFrom52wHigh } },
    analyst: { score, raw: { buy, hold, sell, avgTarget } },
    bonus: { score, raw: { catalysts: [], insiderBuys, etc. } }
  },
  prices: {
    current, entryLow, entryHigh, target12m, stopLoss, riskReward
  },
  horizonMonths: number,
  computedAt: timestamp
}
```

### Cache strategy
- 1h dla bieżących cen (refresh na intraday spike >3%)
- 24h dla fundamentals
- Invalidate na earnings event

---

## EKRAN 2: PERSONAL FIT SCORE 🎯 (TWÓJ MOAT)

### Cel
Pokazać że **TA SAMA spółka jest inną decyzją dla różnych userów**. To jest moment "WOW" którego konkurencja nie ma.

### Layout

```
┌─────────────────────────────────────┐
│ ← Personal Fit                       │
├─────────────────────────────────────┤
│                                     │
│  Market Verdict:        73 / 100    │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║  Twój Personal Fit:           ║ │
│  ║                               ║ │
│  ║        41 / 100               ║ │
│  ║                               ║ │
│  ║  Niżej o 32 pkt                ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ✓ CO PASUJE:                       │
│  • Twój styl: value (8/10)          │
│  • Sektor comfort: tech (9/10)      │
│  • Dividend preference ✓            │
│                                     │
│  ⚠ CO NIE PASUJE DLA CIEBIE:        │
│                                     │
│  • Twoja koncentracja w tech: 47%   │
│    Dodanie AAPL: → 54%              │
│    Twój próg ryzyka: 40%            │
│                                     │
│  • Twoja avg hold time: 67 dni      │
│    Ta teza wymaga: 12+ miesięcy     │
│                                     │
│  • Wzorzec: 3 ostatnie momentum     │
│    trade'y po wzroście >40%         │
│    Średnia strata: -23%             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   Kup mimo to (świadomie)   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Pokaż lepsze alternatywy  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │   Skip, ustaw alert         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Logika Personal Fit Score

```typescript
personalFit = baseScore;

// Style match (0-25 pkt)
styleMatch = compareStyles(
  user.psycheProfile.investorStyle,    // np. "value-oriented"
  stock.styleAttributes                 // np. ["value", "dividend"]
);

// Sector comfort (0-20 pkt)
sectorComfort = user.psycheProfile.sectorPerformance[stock.sector];
// Historyczna performance w tym sektorze

// Concentration check (0-15 pkt, malus jeśli przekracza próg)
currentSectorWeight = portfolio.sectorBreakdown[stock.sector];
if (currentSectorWeight + proposedSize > user.maxSectorThreshold) {
  malus = (currentSectorWeight + proposedSize - user.maxSectorThreshold) * 2;
}

// Hold time match (0-15 pkt)
avgUserHold = user.avgHoldDays;
expectedHold = stock.estimatedThesisHorizonDays;
if (avgUserHold < expectedHold * 0.5) {
  malus = "thesis_too_long_for_user_pattern";
}

// Recent pattern check (0-15 pkt)
similarTrades = user.tradeHistory.filter(t => 
  t.stockProfile.matchesPattern(stock.currentProfile)
);
recentSimilarPerformance = avg(similarTrades.last3.returnPct);

// Bias triggers (0-10 pkt malus)
biases = checkBiasTriggers(user.psycheProfile.top3Biases, stock, market);
// np. "momentum chase" bias + stock up 100% YTD = high malus

personalFit = clamp(baseScore + adjustments, 0, 100);
```

### Required data

**Z Trader Psyche System (już masz):**
- `user.psycheProfile.investorStyle`
- `user.psycheProfile.top3Biases`
- `user.psycheProfile.goodConditions` / `badConditions`
- `user.psycheProfile.growthScore`
- `user.tradingRules[]`

**Z Decision Log (już masz):**
- `user.tradeHistory` z setupami, holdTime, performance
- `user.avgHoldDays` (kalkulowane)
- `user.sectorPerformance` (kalkulowane)

**Z portfolio (już masz):**
- `portfolio.sectorBreakdown`
- `portfolio.currentPositions`
- `portfolio.totalValue`

### Endpoint

```
GET /api/v1/company/:ticker/personal-fit
Authorization: required (need user context)

Response: {
  ticker: string,
  marketScore: number,        // 73
  personalScore: number,      // 41
  delta: number,              // -32
  
  matches: [                  // co pasuje
    { dimension: "style", value: "value", score: 8, max: 10 },
    { dimension: "sector_comfort", value: "tech", score: 9, max: 10 },
    ...
  ],
  
  mismatches: [               // co nie pasuje
    {
      dimension: "concentration_risk",
      severity: "high",
      explanation: "Twoja koncentracja w tech: 47%. Dodanie AAPL → 54%.",
      threshold: "Twój próg ryzyka: 40%",
      data: { currentWeight: 47, afterPurchase: 54, threshold: 40 }
    },
    {
      dimension: "hold_time_mismatch",
      severity: "medium",
      explanation: "Twoja avg hold time: 67 dni. Ta teza wymaga: 12+ miesięcy.",
      data: { userAvg: 67, thesisRequires: 365 }
    },
    {
      dimension: "pattern_warning",
      severity: "high",
      explanation: "3 ostatnie momentum trade'y po wzroście >40%. Średnia strata: -23%.",
      data: { 
        similarTrades: [
          { ticker: "NVDA", entryAfterRally: 187, return: -28 },
          { ticker: "TSLA", entryAfterRally: 95, return: -19 },
          { ticker: "PLTR", entryAfterRally: 220, return: -22 }
        ]
      }
    }
  ],
  
  suggestedActions: [
    { 
      action: "show_alternatives",
      reasoning: "5 spółek o podobnej tezie z lepszym Personal Fit",
      alternatives: ["MSFT", "GOOGL", "META"]
    },
    {
      action: "set_alert",
      reasoning: "Czekaj na korektę -15% do $159",
      targetPrice: 159
    }
  ]
}
```

### Cache strategy
- Personal Fit jest **per user per ticker** — nie cache'uj globalnie
- Cache na user 1h (invalidate gdy user dodaje trade)
- Compute kosztowne (joins na 3 tabele) — zoptymalizuj query

---

## EKRAN 3: CINEMATIC STORY (3 akty AI narrative)

### Cel
**Storytelling**, nie data dump. User pamięta historie, nie tabele.

### Layout

```
┌─────────────────────────────────────┐
│ ← Historia AAPL                      │
├─────────────────────────────────────┤
│                                     │
│  📖 AKT 1: PRZESZŁOŚĆ               │
│                                     │
│  [animated chart: 2007-2019]        │
│                                     │
│  "W 2007 roku Apple było 'tym       │
│  drugim'. Microsoft dominował,      │
│  Nokia rządziła telefonami.         │
│  Steve Jobs wszedł na scenę        │
│  z iPhone'm — i zmienił świat.     │
│  18x stock przez następne 10 lat,   │
│  $200 miliardów cash, najdroższa    │
│  firma świata."                     │
│                                     │
│  Liczby które definiowały erę:      │
│  • iPhone units 2007: 1.4M          │
│  • iPhone units 2019: 196M          │
│  • Revenue 2007 → 2019: $24B→$260B  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🎬 AKT 2: TERAŹNIEJSZOŚĆ           │
│                                     │
│  [chart: 2020-2026]                 │
│                                     │
│  "Apple 2026: zwycięstwo i          │
│  wyzwanie razem. Największa firma   │
│  świata ($3.5T market cap), ale     │
│  wzrost spowalnia. Chiny -23%       │
│  YoY. Vision Pro flop. AI strategy  │
│  niejasna — gdzie Apple Intelligence│
│  vs OpenAI, Google, Anthropic?      │
│  Tim Cook świetny w execution,      │
│  pytanie: jeszcze ma wizję?"        │
│                                     │
│  Kluczowe metryki dziś:             │
│  • Q1 FY26: revenue +2% YoY         │
│  • Services rosną +14% (jasny punkt)│
│  • iPhone replacement cycle: 4.2 lat│
│  • Buyback: $90B autoryzowane       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🔮 AKT 3: TRZY SCENARIUSZE         │
│                                     │
│  Wybierz swoją tezę:                │
│                                     │
│  ┌─ BULL (~30% prawdop.) ─────┐    │
│  │ "Apple Intelligence trafia │    │
│  │ z opóźnieniem ale dobrze.  │    │
│  │ AI features driverem nowego│    │
│  │ super-cycle iPhone. Vision │    │
│  │ Pro 2 lżejszy. Margins    │    │
│  │ rosną. Target: $260 (+39%)│    │
│  └────────────────────────────┘    │
│                                     │
│  ┌─ BASE (~50% prawdop.) ────┐     │
│  │ "Steady compound. iPhone   │     │
│  │ refreshes generują FCF.   │     │
│  │ Services niemniej +12%/rok.│     │
│  │ Niewielka AI integracja.  │     │
│  │ Target: $215 (+15%)"      │     │
│  └────────────────────────────┘     │
│                                     │
│  ┌─ BEAR (~20% prawdop.) ───┐      │
│  │ "Chiny dalej -15% YoY.   │      │
│  │ AI strategy fail vs GOOG.│      │
│  │ Vision Pro 2 też flop.   │      │
│  │ P/E kompresja z 32→24.   │      │
│  │ Target: $150 (-20%)"     │      │
│  └────────────────────────────┘     │
│                                     │
│  [Dalej: Historical Twins →]        │
└─────────────────────────────────────┘
```

### AI Narrative Generation

**Model:** Claude Sonnet 4.6 (3 wywołania: po jednym na akt)
**Koszt:** ~$0.04 per pełna analiza (3x Sonnet calls + dane)
**Cache:** 24h, invalidate na earnings/major news

### System prompt dla AI (template)

```
SYSTEM PROMPT — Cinematic Stock Storyteller

Jesteś analitykiem inwestycyjnym, który pisze finansowy storytelling 
na poziomie The Economist / Bloomberg Businessweek. Pisz krótko, 
konkretnie, z dużą energią narracyjną.

OTRZYMUJESZ structured data dla spółki [TICKER] (sekcja "data" w JSON).
TWOIM ZADANIEM jest napisanie [AKT 1/2/3] tej historii.

ZASADY:
1. UŻYWAJ TYLKO LICZB Z DATA (nie wymyślaj)
2. Maksymalnie 100 słów na akt
3. Konkretne daty, konkretne liczby
4. Storytelling voice — jak dziennikarz, nie analityk
5. Akt 1: przeszłość, jak doszło do tego momentu
6. Akt 2: teraźniejszość, gdzie spółka jest dziś (mocne strony + napięcia)
7. Akt 3: 3 scenariusze (bull/base/bear) z prawdopodobieństwami i targetami
8. Język: [user.language]
9. Ton: w zależności od user.experienceLevel:
   - beginner: prostsze metafory, więcej kontekstu
   - intermediate: standardowy
   - advanced: techniczny

INPUT:
{
  ticker: "AAPL",
  data: {
    history_5y: { ... },
    history_10y: { ... },
    current_state: { ... },
    catalysts_upcoming: [ ... ],
    risks: [ ... ],
    peer_comparison: { ... },
    sector_trends: { ... }
  },
  user: {
    language: "pl",
    experienceLevel: "intermediate"
  },
  act: 1 | 2 | 3
}

OUTPUT (per akt):
{
  act: number,
  title: string,           // np. "AKT 1: PRZESZŁOŚĆ"
  narrative: string,       // max 100 słów
  key_numbers: [
    { label: string, value: string }
  ],
  // tylko dla aktu 3:
  scenarios: [
    {
      name: "BULL" | "BASE" | "BEAR",
      probability: number,
      narrative: string,
      target_price: number,
      target_pct: number
    }
  ]
}
```

### Endpoint

```
GET /api/v1/company/:ticker/story
Query params: ?language=pl&experienceLevel=intermediate

Response: {
  ticker: string,
  acts: [
    { act: 1, title, narrative, key_numbers, illustration_chart_id },
    { act: 2, title, narrative, key_numbers, illustration_chart_id },
    { act: 3, title, scenarios: [bull, base, bear] }
  ],
  generated_at: timestamp,
  language: string
}
```

### Caching i koszty

**Smart caching:**
- Akt 1 (przeszłość): cache 30 dni — historia się nie zmienia
- Akt 2 (teraźniejszość): cache 24h — invalidate na earnings/news
- Akt 3 (scenariusze): cache 7 dni — invalidate na major catalyst

**Koszt per user per analysis:**
- Cold path (cache miss wszystkie 3 akty): $0.04
- Warm path (1 akt cache hit): $0.025
- Hot path (wszystkie cache hit): $0 (free)

**Przy 1000 DAU × 5 analiz dziennie = 5000 analiz/dzień**
**Avg cache hit rate 70% → koszt ~$60/dzień = $1,800/miesiąc**

To wciąż w marginesie ($29/Pro × 100 Pro userów = $2,900/miesiąc → 60% margin).

---

## EKRAN 4: HISTORICAL TWIN (Signal DNA evolved)

### Cel
**Pattern recognition na sterydach**: pokazać 3 historyczne setupy które przypominają obecny, i co się działo dalej.

### Layout

```
┌─────────────────────────────────────┐
│ ← Historical Twins                   │
├─────────────────────────────────────┤
│                                     │
│  AAPL teraz przypomina:             │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 1. MSFT 2014 (Match: 87%)    │ │
│  │                              │ │
│  │ [mini wykres przed → po]     │ │
│  │                              │ │
│  │ Co było wspólne:              │ │
│  │ • P/E ratio ~32x              │ │
│  │ • Revenue growth ~5%/yr       │ │
│  │ • Wątpliwości co do innowacji │ │
│  │ • Cloud transformation start  │ │
│  │                              │ │
│  │ Co się stało DALEJ:           │ │
│  │ +258% w 5 lat                 │ │
│  │ Azure trafił w punkt          │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 2. CSCO 1999 (Match: 71%)    │ │
│  │                              │ │
│  │ [mini wykres przed → po]     │ │
│  │                              │ │
│  │ Co było wspólne:              │ │
│  │ • Dominacja sektorowa         │ │
│  │ • Wszyscy mieli w portfelu    │ │
│  │ • P/E 30x+                    │ │
│  │ • "Można nigdy nie sprzedać"  │ │
│  │                              │ │
│  │ Co się stało DALEJ:           │ │
│  │ -89% w 2.5 roku              │ │
│  │ Dot-com bust                  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 3. NOK 2010 (Match: 63%)     │ │
│  │                              │ │
│  │ [mini wykres przed → po]     │ │
│  │                              │ │
│  │ Co było wspólne:              │ │
│  │ • Lider sprzętowy             │ │
│  │ • Wątpliwości software AI/OS │ │
│  │ • Cash mountain bez kierunku │ │
│  │                              │ │
│  │ Co się stało DALEJ:           │ │
│  │ -73% w 3 lata                │ │
│  │ iPhone zabił Nokia            │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  STATYSTYKA TWINS:           │   │
│  │  Bull (+50%+): 1/3 (33%)    │   │
│  │  Flat (-20 do +20%): 0/3    │   │
│  │  Bear (-30%+): 2/3 (67%)    │   │
│  │                              │   │
│  │  Średni outcome 5 lat: -25% │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Algorithm: Historical Twin Matcher

**Wymaga:** historyczna baza 1000+ "setupów" — kompletnych snapshotów (multi-dimension) spółek w różnych momentach historii, z 5-letnim "what happened next".

**Dimensions do matchowania:**

```typescript
interface StockSetup {
  ticker: string;
  date: Date;
  
  // Valuation
  pe: number;
  pe_vs_sector: number;        // current pe / sector median pe
  pe_vs_history: number;       // current pe / own 10y avg pe
  ps: number;
  ev_ebitda: number;
  
  // Growth
  revenue_growth_3y: number;
  earnings_growth_3y: number;
  growth_decelerating: boolean;
  
  // Financial
  net_debt_to_ebitda: number;
  fcf_yield: number;
  margin_trend_3y: 'expanding' | 'stable' | 'compressing';
  
  // Market position
  market_cap_rank_in_sector: number;
  market_share_trend: 'gaining' | 'stable' | 'losing';
  
  // Sentiment
  analyst_buy_pct: number;
  retail_ownership_pct: number;
  short_interest: number;
  
  // Macro context
  rate_environment: 'rising' | 'flat' | 'falling';
  sector_momentum: number;
  market_breadth: number;
  
  // Outcome (5 years later)
  outcome_5y_return: number;
  outcome_max_drawdown: number;
  outcome_volatility: number;
}
```

**Matching algorithm:**

```typescript
function findTwins(currentSetup: StockSetup, db: StockSetup[]): Match[] {
  return db
    .map(historicalSetup => ({
      setup: historicalSetup,
      score: computeSimilarity(currentSetup, historicalSetup)
    }))
    .filter(m => 
      m.setup.ticker !== currentSetup.ticker &&  // exclude self
      m.setup.date < addYears(currentSetup.date, -5)  // need 5y future data
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function computeSimilarity(a: StockSetup, b: StockSetup): number {
  // Weighted euclidean distance, normalized to 0-100 match score
  const weights = {
    pe: 0.15,
    pe_vs_history: 0.20,
    revenue_growth_3y: 0.15,
    margin_trend: 0.10,
    growth_decelerating: 0.10,
    sentiment: 0.15,
    macro: 0.15
  };
  
  // Compute weighted distance
  let distance = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    distance += weight * normalizedDifference(a[dim], b[dim]);
  }
  
  // Convert distance to similarity score (0-100)
  return 100 * (1 - distance);
}
```

### Data requirements

**Build historical setups database:**

To jest największy lift technicznie. Krok-po-kroku:

1. **Source:** EODHD ma 10+ lat historycznych fundamentals dla 60,000+ spółek
2. **Snapshot generation:** Co kwartał, dla każdej spółki, generate StockSetup snapshot
3. **Outcome tagging:** Dla każdego snapshot'u 5 lat starszego, oblicz outcome
4. **Storage:** TimescaleDB tabela `stock_setups_history` (hypertable per kwartał)
5. **Indexing:** Faiss / Pinecone dla similarity search (lub PostgreSQL z pgvector)

**Estymowany rozmiar:**
- 60,000 stocks × 40 quarters × 30 dimensions = 72M data points
- ~5GB storage (raw)
- ~500MB indexed dla fast similarity search

**Czas budowy (Cursor):** 1-2 tygodnie na initial build + ongoing data pipeline.

### Endpoint

```
GET /api/v1/company/:ticker/twins
Query: ?limit=3&min_match=60

Response: {
  ticker: string,
  current_setup: { ... },     // full StockSetup
  
  twins: [
    {
      ticker: "MSFT",
      date_of_match: "2014-Q1",
      match_score: 87,         // 0-100
      
      common_attributes: [
        { dimension: "pe", current: 32.1, twin: 30.8 },
        { dimension: "revenue_growth", current: 5.2, twin: 5.4 },
        { dimension: "margin_trend", current: "stable", twin: "stable" },
        { dimension: "sentiment", current: "mixed", twin: "mixed" }
      ],
      
      outcome_5y: {
        total_return_pct: 258,
        max_drawdown_pct: -12,
        volatility_annualized: 22,
        notable_events: [
          "Azure inflection point 2015",
          "Cloud revenue surpassed Office 2018"
        ]
      },
      
      lesson: "Cloud transformation worked. Question is: can AAPL pull off similar pivot with AI?"
    },
    // ... 2 more twins
  ],
  
  statistics: {
    bullish_outcomes: 1,        // count with >50% return
    flat_outcomes: 0,
    bearish_outcomes: 2,        // count with <-20% return
    avg_5y_return: -25
  },
  
  ai_synthesis: "AAPL's setup splits 1:2 between MSFT 2014 (worked) and CSCO 1999 + NOK 2010 (didn't). The deciding factor will be AI execution. If Apple Intelligence works, you're buying MSFT 2014. If it doesn't, you're holding CSCO 1999."
}
```

### "Wow factor" implementation tips

1. **Animated chart transitions** — gdy user kliknie twin, wykres przeszłej spółki animuje "before → after"
2. **Side-by-side comparison** — możliwość porównania obecnej spółki z twin'em na jednym wykresie
3. **Drill-down** — klik na "common attribute" pokazuje szczegóły porównania
4. **Share button** — userzy chcą screenshotować to i wrzucać na X/Twitter ("OMG AAPL jest jak CSCO 1999, look!")

To jest moment maximum "wow" — userzy będą o tym opowiadać znajomym.

---

## EKRAN 5: WHAT'S THE CATCH 🎯

### Cel
**Brutalna prawda jako feature.** Inni unikają. Ty robisz flagship.

### Layout

```
┌─────────────────────────────────────┐
│ ← What's the Catch                   │
├─────────────────────────────────────┤
│                                     │
│  Każdy bull case ma haczyk.         │
│  Oto Twój:                          │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║  💎 BULL CASE                 ║ │
│  ║                               ║ │
│  ║  Najmocniejszy argument ZA:   ║ │
│  ║                               ║ │
│  ║  "Services growing +14% YoY,  ║ │
║  ║  najmocniejsza marża 71%,    ║ │
│  ║  $200B cash to buyback        ║ │
│  ║  iPhone replacement cycle      ║ │
│  ║  bottoming z 4.2 lat — next   ║ │
│  ║  refresh dramatic."           ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║  ⚠️  BEAR CASE                ║ │
│  ║                               ║ │
│  ║  Najmocniejszy argument PRZECIW│ │
│  ║                               ║ │
│  ║  "Chiny -23% YoY i przyspiesz.║ │
│  ║  Apple Intelligence opóźnione.║ │
│  ║  Vision Pro flop (1M units    ║ │
│  ║  vs forecast 3M). Tim Cook   ║ │
│  ║  bez wizji następcy Jobs'a." ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║                               ║ │
│  ║  🔥 THE DIRTY TRUTH           ║ │
│  ║                               ║ │
│  ║  Rzecz której nikt nie mówi:  ║ │
│  ║                               ║ │
│  ║  "Insiderzy sprzedali $152M  ║ │
│  ║  w 90 dni. Tim Cook         ║ │
│  ║  sprzedał 511,000 akcji      ║ │
│  ║  za $87.8M w marcu 2026.    ║ │
│  ║  Zero zakupów insiderów      ║ │
│  ║  od 18 miesięcy."           ║ │
│  ║                               ║ │
│  ║  [Pokaż transakcje insiderów]║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🎯 Pre-Mortem AI            │   │
│  │  "Wyobraź sobie że za 12 mc │   │
│  │  ten trade stracił -40%.    │   │
│  │  Co prawdopodobnie poszło   │   │
│  │  źle? Zacznij analizę →"    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ──── Final Decision ────           │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ Kup ($187)  │ │   Pas       │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Mirror trade z analizy     │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Logika "Dirty Truth"

To NIE jest losowe — to **najmocniejszy bear signal** który **NIE jest w bull case ani standard bear case**. Algorithm wybiera z kategorii:

```typescript
const dirtyTruthCandidates = [
  // Insider behavior
  { type: 'insider_net_selling', threshold: 50_000_000_USD_90d },
  { type: 'insider_no_buys_long', threshold: 18_months_no_insider_buy },
  { type: 'ceo_major_sale', threshold: 50_000_000_USD_single_sale },
  
  // Dilution
  { type: 'shares_growing_fast', threshold: 15_pct_dilution_1y },
  { type: 'active_atm', threshold: exists },
  
  // Accounting red flags
  { type: 'declining_fcf_quality', threshold: fcf_vs_eps_diverging },
  { type: 'inventory_buildup', threshold: 20_pct_above_revenue_growth },
  { type: 'receivables_buildup', threshold: 25_pct_above_revenue_growth },
  
  // Customer concentration
  { type: 'top_customer_concentration', threshold: 25_pct_revenue_single },
  
  // Hidden risks
  { type: 'pending_litigation_material', threshold: known_lawsuit_value },
  { type: 'regulatory_investigation', threshold: known_investigation },
  
  // Sentiment hidden
  { type: 'short_interest_rising', threshold: rising_3_months },
  { type: 'put_call_ratio_extreme', threshold: pcr_above_15 }
];

function findDirtyTruth(stock: Stock): DirtyTruth | null {
  const candidates = dirtyTruthCandidates
    .filter(c => c.evaluate(stock))
    .sort((a, b) => b.severity - a.severity);
  
  return candidates[0] || null;
}
```

Jeśli nie ma żadnej "dirty truth" — sekcja pokazuje: **"🟢 Nie znaleziono ukrytych red flagów. Tym razem czysto."**

Tym samym **kiedy dirty truth się pojawia** — userzy traktują to bardzo poważnie, bo wiedzą że nie jest fabrykowane.

### Pre-Mortem AI Integration

Button na końcu uruchamia istniejący Pre-Mortem AI z kontekstem tej analizy. Kontekst auto-passed:
- Ticker
- Verdict score
- Identified bear case
- Dirty truth (jeśli jest)
- User's personal mismatches

User wchodzi w Pre-Mortem już z bogactwem kontekstu, nie od zera.

### Endpoint

```
GET /api/v1/company/:ticker/catch

Response: {
  ticker: string,
  bull_case: {
    title: "BULL CASE",
    narrative: string,        // 3 zdania, AI-generated
    supporting_facts: [
      { fact, source }
    ]
  },
  bear_case: {
    title: "BEAR CASE",
    narrative: string,        // 3 zdania, AI-generated
    supporting_facts: [
      { fact, source }
    ]
  },
  dirty_truth: {
    title: "THE DIRTY TRUTH",
    one_liner: string,        // max 1 zdanie, BOLD
    details: string,          // expandable
    severity: "high" | "medium" | "low",
    evidence_link: string,    // link do SEC filing, news, etc.
    category: "insider" | "dilution" | "accounting" | "sentiment" | "regulatory"
  } | null,                   // null jeśli nic nie znaleziono
  
  pre_mortem_context: {
    auto_filled_prompts: [    // dla Pre-Mortem AI
      "What if Chinese revenue continues declining?",
      "What if Apple Intelligence fails to launch in time?",
      "What if insiders are right and stock drops 30%?"
    ]
  },
  
  final_actions: [
    { action: "buy", price: 187, sizing: "personalized" },
    { action: "pass", reasoning: "wait for pullback to $159" },
    { action: "mirror_trade", description: "Share this analysis with community" }
  ]
}
```

---

## Komponenty React do zbudowania

```
src/pages/
  PremiumCompanyAnalysis.tsx       (main container, manages 5 screens)
  
src/components/premium-analysis/
  Screen1Verdict.tsx
  Screen2PersonalFit.tsx
  Screen3CinematicStory.tsx
  Screen4HistoricalTwin.tsx
  Screen5WhatsTheCatch.tsx
  
  ScreenNavigator.tsx              (swipe/click między ekranami)
  
  components/
    VerdictScoreCircle.tsx         (gigantyczny score)
    PersonalFitComparison.tsx      (market vs personal score)
    StoryAct.tsx                   (1 akt z animacją)
    TwinCard.tsx                   (1 twin z mini chart)
    DirtyTruthBox.tsx              (red flag wyróżniony)
    BullBearComparison.tsx
    ActionButtons.tsx              (Kup / Pas / Mirror)
```

### State management

```typescript
// src/stores/premiumAnalysisStore.ts (Zustand)

interface PremiumAnalysisState {
  ticker: string | null;
  
  // Data
  verdict: VerdictData | null;
  personalFit: PersonalFitData | null;
  story: StoryData | null;
  twins: TwinsData | null;
  catch: CatchData | null;
  
  // UI state
  currentScreen: 1 | 2 | 3 | 4 | 5;
  isLoading: Record<string, boolean>;
  errors: Record<string, Error | null>;
  
  // Actions
  loadAnalysis: (ticker: string) => Promise<void>;
  navigateToScreen: (n: number) => void;
  triggerPreMortem: () => void;
  triggerMirrorTrade: () => void;
}
```

### Smart prefetching

```typescript
// Load Screen 1 immediately, prefetch 2-5 w tle
loadAnalysis(ticker) {
  this.loadVerdict(ticker);            // immediate
  setTimeout(() => this.loadPersonalFit(ticker), 100);
  setTimeout(() => this.loadStory(ticker), 500);
  setTimeout(() => this.loadTwins(ticker), 1000);
  setTimeout(() => this.loadCatch(ticker), 1500);
}
```

User widzi pierwszy ekran w <500ms, reszta ładuje się gdy nawiguje.

---

## Plan implementacji (Cursor sprint)

### Sprint 1 (Tydzień 1): Foundation + Screen 1
- Route `/company/[ticker]/premium`
- PremiumCompanyAnalysis container z navigatorem
- Screen 1 (Verdict) — deterministic composite score
- Backend endpoint `/api/v1/company/:ticker/verdict`
- Cache layer (Redis)
- Basic styling + animations

### Sprint 2 (Tydzień 2): Screen 2 Personal Fit
- Backend endpoint `/api/v1/company/:ticker/personal-fit`
- Integracja z Trader Psyche System
- Logika style matching, sector comfort, concentration check
- UI z dramatic visual delta (market vs personal)
- Suggested actions logic

### Sprint 3 (Tydzień 3): Screen 3 Cinematic Story
- Backend endpoint `/api/v1/company/:ticker/story`
- System prompt dla Claude (3 wywołania per akt)
- AI narrative generation pipeline
- Caching strategy (akt 1 = 30d, akt 2 = 24h, akt 3 = 7d)
- UI z animowanymi wykresami

### Sprint 4 (Tydzień 4-5): Screen 4 Historical Twin (najtrudniejsze)
- Database schema dla stock_setups_history (TimescaleDB)
- Pipeline budowy snapshotów z EODHD
- Similarity search (pgvector lub Faiss)
- Backend endpoint `/api/v1/company/:ticker/twins`
- AI synthesis prompt (Claude)
- UI z side-by-side comparisons + animations

### Sprint 5 (Tydzień 6): Screen 5 What's the Catch
- Backend endpoint `/api/v1/company/:ticker/catch`
- Dirty Truth detection algorithm
- Bull/Bear case AI generation
- Integration z Pre-Mortem AI (auto-pass context)
- Integration z Mirror Trading

### Sprint 6 (Tydzień 7): Polish + Beta
- Loading states i empty states
- Error handling
- Mobile UX testing
- Performance optimization
- Beta release dla Biznesmisji testerów

**Total: ~7 tygodni do production-ready** w Cursor sprint mode.

---

## Tier gating szczegółowo

### Free tier
- Ekran 1 (Verdict) ✓
- Ekrany 2-5: blurred z teaserem "Otwórz pełną analizę za 49 PLN/miesiąc"
- 3 pełne analizy/miesiąc

### Pro (49 PLN/miesiąc)
- Wszystkie ekrany 1-4 ✓
- Ekran 5 (Personal Fit): podstawowa wersja bez Decision Log integration
- 50 pełnych analiz/miesiąc
- Brak Pre-Mortem AI z auto-context

### Pro+ (149 PLN/miesiąc)
- Wszystkie ekrany ✓
- Pełny Personal Fit z Trader Psyche
- Unlimited analiz
- Pre-Mortem AI z auto-context
- Mirror Trading z analizy
- Priority Claude (Opus 4.7 zamiast Sonnet 4.6)

---

## Koszty operacyjne (estymacja)

**Per analysis cost breakdown:**
- Verdict: $0.001 (deterministic, no AI)
- Personal Fit: $0.002 (DB joins, no AI)
- Cinematic Story: $0.03 (3 Sonnet calls)
- Historical Twin: $0.01 (vector search) + $0.005 (AI synthesis)
- What's the Catch: $0.01 (Sonnet narratives)

**Total cold path: $0.058 per analysis**

**Z 70% cache hit rate: $0.017 per analysis**

**Przy 1000 Pro userów × 5 analiz/dzień × 30 dni = 150,000 analiz/miesiąc**
**Koszt: ~$2,550/miesiąc**

**Revenue: 1000 × 49 PLN ≈ $12,000/miesiąc**
**Gross margin: ~79%**

To jest zdrowy unit economics. Skaluje się dobrze.

---

## "Wow moments" — gdzie ludzie powiedzą "WOW"

### Moment 1: Verdict-first (Screen 1)
"Widzę gigantyczny 73 i wiem co robić w 5 sekund. Żadna inna aplikacja tego nie ma."

### Moment 2: Personal Fit shock (Screen 2)
"Czekaj... ta sama spółka jest 73 dla rynku ale 41 dla MNIE? Pokazuje mi dokładnie dlaczego — moja koncentracja, moje wzorce. **Skąd ono to wie?!**"

### Moment 3: Historical Twin reveal (Screen 4)
"Apple teraz wygląda jak Cisco 1999 + MSFT 2014. **Pokazuje mi konkretne dane porównawcze i co się stało dalej**. To jest insight, nie data!"

### Moment 4: Dirty Truth (Screen 5)
"Insiderzy sprzedali $152M w 90 dni i **nikt o tym nie pisze**. Aplikacja mówi mi prawdę której Bloomberg by nigdy nie pokazał na pierwszej stronie."

### Moment 5: Share-worthy screenshot
"Muszę to wrzucić na Twittera/X. Mój znajomy musi to zobaczyć." → organic growth

---

## Final notes

**To NIE jest 30-dniowy projekt.** To jest 6-8 tygodniowy sprint dla Cursor'a w realistycznym tempie.

**Ale to JEST realne flagship feature** które naprawdę wywołuje "wow" — nie marketingowo, tylko strukturalnie.

**Najtrudniejsze:** Historical Twin (database + algorithm). To może wziąć 2 tygodnie samo.

**Najłatwiejsze:** Verdict + Personal Fit (masz już 80% danych w bazie).

**Najwięcej wartości:** Personal Fit Score — bo to TWÓJ jedyny prawdziwy moat. Pozostałe ekrany konkurencja może skopiować w ciągu roku. Personal Fit wymaga miesięcy używania przez usera = trwała przewaga.

---

## Decision points dla Ciebie zanim przekażesz Cursor'owi

1. **Naming:** "Premium Company Analysis" czy coś bardziej brand-strong? ("StockDNA Report" / "Deep Read" / "X-Ray Analysis")

2. **Pricing tier struktura:** zostawiamy 3 tiery jak wyżej, czy zmieniamy?

3. **Mobile-first czy desktop-first:** mobile uważam strongly recommend, ale to decyzja Twoja

4. **Order ekranów:** zaproponowałem 1→2→3→4→5. Możesz odwrócić 3-4 (Story przed Twins lub odwrotnie)

5. **Historical Twin scope:** zaczynamy od US-only (3000 stocks × 40 quarters = 120k setups, manageable) czy globalnie od razu (60k stocks = 2.4M setups, znacznie więcej pracy)?

Daj feedback i przygotowuję wersję final do oddania Cursor'owi.

---

*Specyfikacja v1.0 — May 2026*
*Status: Ready for Cursor implementation*
*Estimated timeline: 6-8 tygodni do production*
