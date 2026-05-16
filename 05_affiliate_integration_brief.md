# Affiliate Broker Integration — Specyfikacja v1.0

> **StockAI Pro — Affiliate Layer (Broker Integration Phase 1)**
> Cel: $20-50k revenue Year 1 bez ryzyka regulacyjnego
> Czas implementacji: 2-3 tygodnie (Cursor)
> Status: Ready for development

---

## Executive Overview

### Co to jest

System affiliate linków do brokerów (XTB, Bossa, eToro, Trade Republic) z pełnym tracking'iem konwersji. Userzy klikają "Kup przez [broker]" w aplikacji, są przekierowani do brokera z parametrami tracking, my zarabiamy commission per zarejestrowany user / pierwszy depozyt / wolumen transakcji.

### Dlaczego to robimy teraz

**1. Najszybszy revenue stream** — kilka tygodni do live, kilka miesięcy do pierwszych wypłat
**2. Zero ryzyka regulacyjnego** — to nie jest broker execution, to marketing
**3. Validacja modelu** — wiemy które rynki konwertują przed inwestycją w Alpaca/Lemon.markets
**4. Foundation pod Phase 2** — infrastruktura tracking'u przydaje się również dla real broker integration

### Model biznesowy

```
User klika "Kup przez XTB" w StockAI Pro
  ↓
Redirect przez naszą stronę z tracking (saved click ID)
  ↓
User trafia na stronę XTB z naszym partner ID
  ↓
User rejestruje konto (FTD = First Time Deposit)
  ↓
XTB płaci nam $50-200 commission (CPA model)
  LUB
XTB płaci % od spread/wolumenu (revenue share)
```

### Realistyczne projekcje przychodów

```
Konserwatywnie (Y1):
- 10,000 free users
- 5% click rate na affiliate links = 500 clicks/miesiąc
- 5% conversion (click → FTD) = 25 konwersji/miesiąc
- $100 avg commission = $2,500/miesiąc = $30k/rok ✓

Optymistycznie:
- 30,000 free users
- 10% click rate = 3,000 clicks/miesiąc  
- 8% conversion = 240 konwersji/miesiąc
- $150 avg = $36,000/miesiąc = $432k/rok
```

Cel Y1: **$30-50k** (konserwatywne założenia).

---

## Architektura systemu

```
┌─────────────────────────────────────────────────────────────┐
│                    STOCKAI PRO FRONTEND                      │
│  (CompanyDetail, SignalsPage, Premium Analysis, Watchlist)  │
└────────────────────────┬────────────────────────────────────┘
                         │
                  [User klika CTA]
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              REDIRECT SERVICE                                │
│  /api/v1/affiliate/redirect?broker=X&ticker=Y&context=Z    │
│                                                              │
│  1. Generate click_id (UUID)                                 │
│  2. Save click → affiliate_clicks (DB)                       │
│  3. Build broker-specific deep link                          │
│  4. 302 redirect to broker URL                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BROKER PLATFORM (XTB / Bossa / eToro / TR)     │
│  User rejestruje konto, robi FTD                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                  [Conversion event]
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              ATTRIBUTION RECONCILIATION                      │
│                                                              │
│  Manual: pobierz raport CSV z broker dashboard               │
│  Auto: webhook (jeśli broker wspiera) lub API polling        │
│                                                              │
│  Match conversions → original click_id → user_id             │
│  Update: affiliate_conversions, payouts                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tabela 1: `affiliate_brokers` (config brokerów)

```sql
CREATE TABLE affiliate_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identyfikacja
  slug VARCHAR(50) UNIQUE NOT NULL,           -- 'xtb', 'bossa', 'etoro', 'trade_republic'
  display_name VARCHAR(100) NOT NULL,         -- 'XTB', 'Bossa', 'eToro', 'Trade Republic'
  logo_url VARCHAR(255),
  
  -- Konfiguracja affiliate
  partner_id VARCHAR(100) NOT NULL,           -- np. nasz ID w systemie XTB
  affiliate_program_url VARCHAR(255),         -- link do partner dashboard
  
  -- Deep link template (z placeholderami)
  base_url VARCHAR(500) NOT NULL,             
  -- np. 'https://www.xtb.com/pl/?utm_source=stockai&utm_medium=affiliate&p={partner_id}&cid={click_id}'
  
  ticker_url_template VARCHAR(500),           -- per instrument deep link jeśli dostępne
  -- np. 'https://www.xtb.com/pl/oferta/akcje/{exchange}/{ticker}?p={partner_id}&cid={click_id}'
  
  -- Tracking
  click_id_param VARCHAR(50) DEFAULT 'cid',   -- nazwa param dla click_id w URL
  attribution_method VARCHAR(20) NOT NULL,    -- 'cookie', 'click_id', 'fingerprint'
  
  -- Geo / rynki
  supported_countries VARCHAR(100)[],         -- ['PL', 'DE', 'FR', ...]
  supported_markets VARCHAR(50)[],            -- ['US', 'GPW', 'XETRA', ...]
  primary_language VARCHAR(5),                -- 'pl', 'de', 'en'
  
  -- Commission structure
  commission_model VARCHAR(20) NOT NULL,      -- 'cpa', 'rev_share', 'hybrid'
  commission_cpa_amount DECIMAL(10,2),        -- np. 100.00 EUR per FTD
  commission_revshare_pct DECIMAL(5,2),       -- np. 30.00 (% spread/volume)
  commission_currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Conversion tracking method
  conversion_tracking VARCHAR(50),            -- 'manual_csv', 'api_polling', 'webhook'
  api_endpoint VARCHAR(255),                  -- jeśli api_polling
  webhook_secret VARCHAR(100),                -- jeśli webhook
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100,               -- sortowanie w UI
  
  -- Disclaimer compliance
  legal_disclaimer JSONB,                     -- { "pl": "...", "en": "...", "de": "..." }
  risk_warning JSONB,                         -- per language
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela 2: `affiliate_clicks` (każde kliknięcie)

```sql
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identyfikacja
  click_id VARCHAR(50) UNIQUE NOT NULL,       -- short ID dla URL (np. nanoid)
  user_id UUID REFERENCES users(id),          -- może być NULL (anonymous click)
  broker_id UUID NOT NULL REFERENCES affiliate_brokers(id),
  
  -- Kontekst kliknięcia
  source_page VARCHAR(100),                   -- 'company_detail', 'signals', 'premium_analysis'
  source_ticker VARCHAR(20),                  -- 'AAPL', 'TSLA'
  source_signal_id UUID,                      -- jeśli z sygnału
  context_data JSONB,                         -- dowolne dodatkowe info
  
  -- Tracking technical
  ip_address INET,
  user_agent TEXT,
  country_code VARCHAR(2),                    -- z geo IP
  language VARCHAR(5),
  device_type VARCHAR(20),                    -- 'mobile', 'desktop', 'tablet'
  
  -- UTM params
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Redirect URL użyty
  redirect_url TEXT NOT NULL,
  
  -- Timestamps
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_user (user_id),
  INDEX idx_broker (broker_id),
  INDEX idx_clicked_at (clicked_at),
  INDEX idx_source_ticker (source_ticker)
);
```

### Tabela 3: `affiliate_conversions` (potwierdzone konwersje)

```sql
CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identyfikacja
  click_id_ref VARCHAR(50) REFERENCES affiliate_clicks(click_id),
  broker_id UUID NOT NULL REFERENCES affiliate_brokers(id),
  user_id UUID REFERENCES users(id),
  
  -- Conversion details
  external_user_id VARCHAR(100),              -- ID usera w systemie brokera (jeśli udostępnione)
  conversion_type VARCHAR(50) NOT NULL,       -- 'signup', 'ftd', 'trade', 'volume_milestone'
  conversion_status VARCHAR(20) NOT NULL,     -- 'pending', 'confirmed', 'paid', 'rejected'
  
  -- Financial
  commission_amount DECIMAL(10,2),
  commission_currency VARCHAR(3),
  ftd_amount DECIMAL(12,2),                   -- jeśli FTD, kwota depozytu
  
  -- Attribution
  attribution_window_days INTEGER,            -- ile dni między click a conversion
  matched_click_id UUID REFERENCES affiliate_clicks(id),
  
  -- Daty
  conversion_date DATE NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  
  -- Raw data z brokera
  raw_broker_data JSONB,                      -- pełny rekord z raportu CSV/API
  
  INDEX idx_broker_date (broker_id, conversion_date),
  INDEX idx_status (conversion_status)
);
```

### Tabela 4: `affiliate_payouts` (wypłaty od brokerów)

```sql
CREATE TABLE affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES affiliate_brokers(id),
  
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3),
  
  conversion_count INTEGER,
  
  status VARCHAR(20) DEFAULT 'pending',       -- 'pending', 'paid', 'disputed'
  paid_at TIMESTAMPTZ,
  reference_number VARCHAR(100),              -- nr przelewu / invoice
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Backend Services & API

### Service 1: ClickTrackingService

```typescript
// src/services/affiliate/ClickTrackingService.ts

export class ClickTrackingService {
  
  async trackClick(params: {
    userId?: string;        // null jeśli anonymous
    brokerSlug: string;     // 'xtb', 'bossa', etc.
    ticker?: string;
    sourcePage: string;
    sourceSignalId?: string;
    request: Request;       // for IP, user agent, geo
  }): Promise<{ clickId: string; redirectUrl: string }> {
    
    // 1. Load broker config
    const broker = await db.affiliateBrokers.findBySlug(params.brokerSlug);
    if (!broker || !broker.is_active) {
      throw new Error(`Broker ${params.brokerSlug} not available`);
    }
    
    // 2. Check geo eligibility
    const countryCode = await getCountryFromIP(params.request.ip);
    if (!broker.supported_countries.includes(countryCode)) {
      throw new Error(`Broker ${params.brokerSlug} not available in ${countryCode}`);
    }
    
    // 3. Generate short click_id (nanoid 12 chars)
    const clickId = nanoid(12);
    
    // 4. Persist click
    await db.affiliateClicks.create({
      click_id: clickId,
      user_id: params.userId || null,
      broker_id: broker.id,
      source_page: params.sourcePage,
      source_ticker: params.ticker,
      source_signal_id: params.sourceSignalId,
      ip_address: params.request.ip,
      user_agent: params.request.headers['user-agent'],
      country_code: countryCode,
      language: params.request.user?.language || 'pl',
      device_type: detectDevice(params.request),
      utm_source: 'stockai',
      utm_medium: 'affiliate',
      utm_campaign: `${params.sourcePage}_${params.ticker || 'generic'}`,
    });
    
    // 5. Build redirect URL with params
    const redirectUrl = buildAffiliateUrl(broker, {
      clickId,
      ticker: params.ticker,
      countryCode,
    });
    
    // 6. Update record with final URL
    await db.affiliateClicks.update(clickId, { redirect_url: redirectUrl });
    
    return { clickId, redirectUrl };
  }
  
  private buildAffiliateUrl(broker: AffiliateBroker, params: any): string {
    let template = params.ticker && broker.ticker_url_template
      ? broker.ticker_url_template
      : broker.base_url;
    
    // Replace placeholders
    template = template
      .replace('{partner_id}', broker.partner_id)
      .replace('{click_id}', params.clickId)
      .replace('{ticker}', params.ticker || '')
      .replace('{country}', params.countryCode || '');
    
    return template;
  }
}
```

### Service 2: ConversionImportService

```typescript
// src/services/affiliate/ConversionImportService.ts

export class ConversionImportService {
  
  /**
   * Manualny import konwersji z CSV pobranego z broker dashboard
   * Wywoływany przez admin UI lub cron (jeśli CSV jest dostępny via API)
   */
  async importFromCSV(brokerSlug: string, csvContent: string): Promise<ImportResult> {
    const broker = await db.affiliateBrokers.findBySlug(brokerSlug);
    const records = parseCSV(csvContent);
    
    const results = {
      imported: 0,
      matched: 0,
      unmatched: 0,
      errors: []
    };
    
    for (const record of records) {
      try {
        // Każdy broker ma inny format CSV — adapter pattern
        const normalized = normalizeBrokerCSV(broker.slug, record);
        
        // Match conversion to click via click_id (jeśli był w URL)
        let matchedClick = null;
        if (normalized.clickIdRef) {
          matchedClick = await db.affiliateClicks.findByClickId(normalized.clickIdRef);
        }
        
        await db.affiliateConversions.create({
          click_id_ref: normalized.clickIdRef,
          broker_id: broker.id,
          user_id: matchedClick?.user_id,
          external_user_id: normalized.externalUserId,
          conversion_type: normalized.conversionType,
          conversion_status: 'confirmed',
          commission_amount: normalized.commissionAmount,
          commission_currency: normalized.currency,
          ftd_amount: normalized.ftdAmount,
          attribution_window_days: matchedClick
            ? daysBetween(matchedClick.clicked_at, normalized.conversionDate)
            : null,
          conversion_date: normalized.conversionDate,
          raw_broker_data: record
        });
        
        results.imported++;
        if (matchedClick) results.matched++;
        else results.unmatched++;
        
      } catch (err) {
        results.errors.push({ record, error: err.message });
      }
    }
    
    return results;
  }
  
  /**
   * Webhook handler (dla brokerów którzy wspierają)
   */
  async handleWebhook(brokerSlug: string, payload: any, signature: string): Promise<void> {
    const broker = await db.affiliateBrokers.findBySlug(brokerSlug);
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, broker.webhook_secret)) {
      throw new UnauthorizedError();
    }
    
    // Process per broker schema
    const normalized = normalizeWebhookPayload(broker.slug, payload);
    await this.createConversion(broker, normalized);
  }
}
```

### REST API Endpoints

```typescript
// src/routes/affiliate.ts

// PUBLIC: Click tracking + redirect
GET /api/v1/affiliate/redirect
Query: ?broker=xtb&ticker=AAPL&page=premium_analysis&signal=uuid
Response: 302 redirect to broker URL

// PUBLIC: Get available brokers for user (filtered by geo)
GET /api/v1/affiliate/brokers
Query: ?country=PL&market=US
Response: {
  brokers: [
    {
      slug: 'xtb',
      display_name: 'XTB',
      logo_url: '...',
      supported_markets: ['US', 'GPW', 'XETRA'],
      pros: ['Polski broker', 'Bez prowizji do €100k/mc', 'GPW + USA'],
      legal_disclaimer: '...'
    },
    ...
  ]
}

// ADMIN: Manual conversion import
POST /api/v1/admin/affiliate/import-csv
Body: { brokerSlug: 'xtb', csvContent: '...' }
Response: ImportResult

// ADMIN: Reports
GET /api/v1/admin/affiliate/dashboard
Query: ?period=last_30d
Response: {
  total_clicks: number,
  total_conversions: number,
  total_commission: number,
  by_broker: [...],
  by_country: [...],
  conversion_funnel: { clicks, signups, ftds, paid }
}

// WEBHOOKS (jeśli broker wspiera)
POST /api/v1/webhooks/affiliate/:brokerSlug
Headers: X-Signature
Body: broker-specific payload
```

---

## Frontend Integration

### Component 1: BrokerCTAButton

Reusable button który pojawia się wszędzie gdzie ma sens "kup spółkę".

```typescript
// src/components/affiliate/BrokerCTAButton.tsx

interface Props {
  ticker?: string;
  signalId?: string;
  sourcePage: 'company_detail' | 'signals' | 'premium_analysis' | 'watchlist';
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary';
}

export function BrokerCTAButton({ ticker, signalId, sourcePage, size = 'medium' }: Props) {
  const { user, country } = useUser();
  const [showBrokerPicker, setShowBrokerPicker] = useState(false);
  
  // Auto-select default broker for user
  const { defaultBroker, availableBrokers } = useAvailableBrokers({ 
    country, 
    market: getMarketFromTicker(ticker)
  });
  
  if (!defaultBroker) return null;  // brak dostępnego brokera dla tego usera
  
  const handleClick = (brokerSlug: string) => {
    // Track click + redirect
    window.location.href = `/api/v1/affiliate/redirect?broker=${brokerSlug}&ticker=${ticker}&page=${sourcePage}${signalId ? `&signal=${signalId}` : ''}`;
  };
  
  return (
    <div>
      <button onClick={() => handleClick(defaultBroker.slug)} className={cn('btn', size)}>
        Kup {ticker || ''} przez {defaultBroker.display_name}
      </button>
      
      {availableBrokers.length > 1 && (
        <button onClick={() => setShowBrokerPicker(true)} className="btn-link">
          inne opcje ({availableBrokers.length - 1})
        </button>
      )}
      
      {showBrokerPicker && (
        <BrokerPickerModal 
          brokers={availableBrokers} 
          onSelect={handleClick}
          onClose={() => setShowBrokerPicker(false)}
        />
      )}
      
      <DisclosureNote />
    </div>
  );
}
```

### Component 2: BrokerPickerModal

```typescript
export function BrokerPickerModal({ brokers, onSelect, onClose }: Props) {
  return (
    <Modal onClose={onClose}>
      <h3>Wybierz brokera</h3>
      <p className="text-sm text-gray-500">
        Każdy z tych brokerów obsługuje tę spółkę. Wybierz wedle własnych preferencji.
      </p>
      
      {brokers.map(broker => (
        <div key={broker.slug} className="broker-card" onClick={() => onSelect(broker.slug)}>
          <img src={broker.logo_url} alt={broker.display_name} />
          <div>
            <h4>{broker.display_name}</h4>
            <ul className="pros">
              {broker.pros.map(pro => <li key={pro}>✓ {pro}</li>)}
            </ul>
          </div>
        </div>
      ))}
      
      <p className="text-xs text-gray-400 mt-4">
        💡 StockAI Pro otrzymuje prowizję jeśli założysz konto. 
        Nie wpływa to na cenę usług ani naszych rekomendacji.
      </p>
    </Modal>
  );
}
```

### Placement w aplikacji — gdzie konkretnie

**CompanyDetail.tsx:**
- Główny CTA pod wykresem cenowym
- Sticky bottom bar na mobile

**SignalsPage:**
- W każdej karcie sygnału, button "Zagraj sygnał → [Broker]"
- Highlight jeśli sygnał jest fresh (<24h)

**Premium Company Analysis:**
- Ekran 1 (Verdict): button "Kup ($187)" → broker picker
- Ekran 5 (What's the Catch): final CTA "Kup mimo to (świadomie)"

**Watchlist:**
- Long-press na pozycji: menu "Kup przez [broker]"

**Paper Trading:**
- Po zamknięciu paper trade w zysku: prompt "Zrób to na żywo → [Broker]"

### "First click" onboarding

Pierwszy raz kiedy user kliknie affiliate CTA, pokazujemy edukacyjny tooltip:

```
┌──────────────────────────────────────────┐
│  💡 Jak to działa                         │
│                                          │
│  Przekierujemy Cię do [Broker], gdzie    │
│  możesz założyć konto i zrealizować     │
│  ten trade.                              │
│                                          │
│  ✓ Twoje dane pozostają u Ciebie         │
│  ✓ Otrzymujemy prowizję od brokera —     │
│    nigdy od Ciebie                        │
│  ✓ Możesz wybrać innego brokera w        │
│    każdej chwili                          │
│                                          │
│  [Rozumiem, przejdź] [Anuluj]           │
└──────────────────────────────────────────┘
```

Trzymaj tę informację w `user_preferences.affiliate_disclosure_seen = true` żeby nie pokazywać ponownie.

---

## Per-Broker Configuration

Konkretne configi dla 4 named brokerów. **Marcin musi sam zarejestrować się w każdym programie partnerskim** — poniżej wartości placeholders, które wypełnia po sign-up.

### XTB

```yaml
slug: xtb
display_name: XTB
logo_url: https://stock-ai.pro/assets/brokers/xtb.svg
partner_id: "{REGISTER_AT_https://xtb.com/pl/partners}"
affiliate_program_url: https://www.xtb.com/pl/partners
base_url: "https://www.xtb.com/pl/?utm_source=stockai&p={partner_id}&cid={click_id}"
ticker_url_template: "https://www.xtb.com/pl/oferta/akcje/{exchange}/{ticker}?p={partner_id}&cid={click_id}"

supported_countries: [PL, DE, FR, ES, IT, RO, CZ, SK, HU]
supported_markets: [GPW, US, XETRA, EURONEXT, LSE]
primary_language: pl

commission_model: cpa
commission_cpa_amount: 100.00         # do uzgodnienia
commission_currency: EUR
conversion_tracking: manual_csv       # XTB ma partner dashboard z CSV export

pros_pl:
  - Polski broker
  - Bez prowizji do €100k/mc
  - GPW + USA + DAX
  - Polski support 24/5

pros_en:
  - European regulated broker
  - Zero commission up to €100k/mo
  - Multi-market access

legal_disclaimer_pl: "CFD są złożonymi instrumentami i wiążą się z dużym ryzykiem szybkiej utraty pieniędzy z powodu dźwigni finansowej. 78% rachunków inwestorów detalicznych traci pieniądze podczas handlu CFD u tego dostawcy."
risk_warning_pl: "Powinieneś rozważyć, czy rozumiesz, jak działają CFD i czy możesz pozwolić sobie na wysokie ryzyko utraty pieniędzy."
```

### Bossa (Dom Maklerski BOŚ)

```yaml
slug: bossa
display_name: Bossa
logo_url: https://stock-ai.pro/assets/brokers/bossa.svg
partner_id: "{REGISTER_AT_https://bossa.pl/program-partnerski}"
base_url: "https://bossa.pl/?utm_source=stockai&p={partner_id}&cid={click_id}"

supported_countries: [PL]
supported_markets: [GPW, US]
primary_language: pl

commission_model: cpa
commission_cpa_amount: 80.00          # do uzgodnienia
commission_currency: PLN
conversion_tracking: manual_csv

pros_pl:
  - Polski dom maklerski (BOŚ Bank)
  - Pełna oferta GPW
  - IKE / IKZE / OIPE
  - Dobre warunki dla aktywnych traderów
```

### eToro

```yaml
slug: etoro
display_name: eToro
logo_url: https://stock-ai.pro/assets/brokers/etoro.svg
partner_id: "{REGISTER_AT_https://www.etoro.com/partners}"
base_url: "https://www.etoro.com/?utm_source=stockai&utm_medium=affiliate&utm_campaign={click_id}&aid={partner_id}"
ticker_url_template: "https://www.etoro.com/markets/{ticker}?aid={partner_id}&utm_campaign={click_id}"

supported_countries: [PL, DE, FR, ES, IT, NL, GB, US, AU, JP, KR]
supported_markets: [US, EU, CRYPTO, FOREX]
primary_language: en

commission_model: cpa
commission_cpa_amount: 120.00         # typically $100-200
commission_currency: USD
conversion_tracking: webhook          # eToro wspiera real-time webhooks

pros_pl:
  - Global broker (140+ krajów)
  - CopyTrader (social trading)
  - Akcje + krypto + ETF + forex
  - Fractional shares
```

### Trade Republic

```yaml
slug: trade_republic
display_name: Trade Republic
logo_url: https://stock-ai.pro/assets/brokers/trade_republic.svg
partner_id: "{REGISTER_AT_https://traderepublic.com/partners}"
base_url: "https://traderepublic.com/?utm_source=stockai&partner={partner_id}&cid={click_id}"

supported_countries: [DE, AT, FR, ES, IT, NL, BE, IE, PT]
supported_markets: [XETRA, US, EURONEXT]
primary_language: de

commission_model: cpa
commission_cpa_amount: 80.00
commission_currency: EUR
conversion_tracking: manual_csv

pros_de:
  - Deutscher Neobroker
  - 1€ pro Trade
  - Mobile-first UX
  - Sparpläne ab 1€

pros_pl:
  - Niemiecki neobroker
  - 1€ za transakcję
  - Mobile-first
  - Plany regularnych zakupów od 1€
```

### Geo-targeting logic

```typescript
function selectDefaultBroker(user: User): Broker | null {
  const country = user.country;
  const market = user.preferredMarket;
  
  const eligible = brokers.filter(b => 
    b.supported_countries.includes(country) &&
    (market ? b.supported_markets.includes(market) : true)
  );
  
  // Priority: per-country preference
  const countryPreferences = {
    'PL': ['xtb', 'bossa', 'etoro'],
    'DE': ['trade_republic', 'etoro', 'xtb'],
    'AT': ['trade_republic', 'etoro'],
    'FR': ['xtb', 'trade_republic', 'etoro'],
    'GB': ['etoro'],
    'US': ['etoro']  // limited, dopiero gdy dodamy Alpaca
  };
  
  const preferred = countryPreferences[country] || ['etoro'];
  
  for (const slug of preferred) {
    const broker = eligible.find(b => b.slug === slug);
    if (broker) return broker;
  }
  
  return eligible[0] || null;
}
```

---

## Analytics & Reporting Dashboard

### Admin Dashboard (`/admin/affiliate`)

**Key metrics (top of page):**
- Total clicks (period selector: today, 7d, 30d, all-time)
- Total conversions
- Click → Conversion rate %
- Total commission (in user's base currency)
- Avg commission per conversion
- Top performing broker

**Charts:**
1. Daily clicks trend (line chart, 30 days)
2. Conversion funnel (clicks → signups → FTDs → paid)
3. Per-broker performance (table)
4. Per-country breakdown (map + table)
5. Top tickers driving clicks (table top 20)
6. Source pages performance (which app section converts best)

**Tables:**
- Recent conversions (last 50)
- Unmatched conversions (need manual attribution)
- Pending payouts per broker

**Actions:**
- Import CSV (per broker)
- Mark conversions as paid
- Adjust broker config (commission rates, status)

### User-facing transparency

W user settings, sekcja **"Mój wpływ"**:

```
Twoje zaufanie się zwraca
─────────────────────────────────────
Dzięki Tobie, w ostatnich 30 dniach:
  
  👀 Kliknięcia w polecanych brokerów: 12
  ✓ Otwartych kont: 1 (XTB)
  💰 Wsparcie StockAI Pro: ~$50

Te środki idą bezpośrednio w rozwój 
aplikacji. Dzięki!

[Zobacz pełną politykę affiliate]
```

To buduje **zaufanie i transparentność**. Userzy widzą że to fair model.

---

## Compliance & Legal

### Wymagania prawne (EU + Polska)

**1. Disclosure obowiązkowy** — KAŻDY affiliate link musi mieć widoczne ujawnienie:
   - "💡 Otrzymujemy prowizję od brokera za każde nowe konto. Nie wpływa to na nasze rekomendacje."
   - Lokalizowane na 9 języków

**2. Risk warning od brokerów CFD** (XTB, eToro):
   - "78% rachunków inwestorów detalicznych traci pieniądze podczas handlu CFD"
   - **MUSI być widoczne** przy każdym CTA do tych brokerów
   - Wymagane przez ESMA / KNF

**3. GDPR compliance:**
   - Click tracking zbiera IP — wymaga consent (już macie cookie banner?)
   - User może żądać deletion swoich click records

**4. Polskie wymagania KNF:**
   - Nie reklamujemy konkretnych instrumentów jako "pewnych zysków"
   - Affiliate disclosure musi być **przed** kliknięciem (nie po)

### Implementation w kodzie

```typescript
// src/components/affiliate/DisclosureNote.tsx
export function DisclosureNote({ broker, variant = 'inline' }: Props) {
  const { t } = useTranslation();
  
  if (variant === 'inline') {
    return (
      <p className="text-xs text-gray-500 mt-2">
        💡 {t('affiliate.disclosure.short')}
      </p>
    );
  }
  
  if (variant === 'full') {
    return (
      <div className="p-3 bg-gray-50 rounded-lg text-xs">
        <p className="font-semibold mb-1">{t('affiliate.disclosure.title')}</p>
        <p>{t('affiliate.disclosure.full')}</p>
        {broker?.is_cfd_provider && (
          <p className="mt-2 text-red-700 font-medium">
            ⚠️ {t('affiliate.disclosure.cfd_warning', { 
              pct: broker.cfd_loss_percentage 
            })}
          </p>
        )}
      </div>
    );
  }
}
```

### Translations (i18n keys do dodania)

```json
// 9 języków: pl, en, de, es, ja, hi, ko, zh-TW, fr
{
  "affiliate": {
    "disclosure": {
      "short": "Otrzymujemy prowizję od brokera. Nie wpływa to na nasze rekomendacje.",
      "title": "Transparentność StockAI Pro",
      "full": "Gdy klikniesz w polecanego brokera i otworzysz konto, StockAI Pro otrzymuje prowizję marketingową. Te środki finansują rozwój aplikacji i pozwalają nam utrzymać Free tier. Nasze rekomendacje opierają się wyłącznie na danych i Twoim profilu — nie na wysokości prowizji od brokerów.",
      "cfd_warning": "{{pct}}% rachunków inwestorów detalicznych traci pieniądze podczas handlu CFD u tego dostawcy. Powinieneś rozważyć, czy rozumiesz, jak działają CFD i czy możesz sobie pozwolić na wysokie ryzyko utraty pieniędzy."
    },
    "cta": {
      "buy_through": "Kup {{ticker}} przez {{broker}}",
      "open_account": "Otwórz konto w {{broker}}",
      "other_options": "Inne opcje ({{count}})"
    }
  }
}
```

---

## Implementation Plan

### Sprint 1 (Tydzień 1): Foundation

**Cursor implements:**
- DB migrations (4 tabele)
- Broker config seed data (4 brokerów z placeholders)
- ClickTrackingService
- Redirect endpoint
- Geo IP lookup integration (np. ipapi.co lub maxmind)
- Basic admin UI dla broker config

**Marcin (paralelnie, papierwork):**
- Sign-up w XTB Partners
- Sign-up w Bossa Program Partnerski  
- Sign-up w eToro Partners
- Sign-up w Trade Republic Partners

### Sprint 2 (Tydzień 2): Frontend Integration

**Cursor implements:**
- BrokerCTAButton komponent (reusable)
- BrokerPickerModal
- DisclosureNote (compliance)
- Integracja w CompanyDetail
- Integracja w SignalsPage
- First-click onboarding tooltip
- Translations (9 języków)

**Marcin:**
- Otrzymanie partner_id od brokerów (zwykle 3-7 dni)
- Update broker configs w DB

### Sprint 3 (Tydzień 3): Conversion Tracking + Dashboard

**Cursor implements:**
- ConversionImportService (CSV parser per broker)
- Admin dashboard z metrics
- Webhook handler dla eToro
- "Mój wpływ" w user settings
- Tests (unit + integration)

**Marcin:**
- Pierwsza beta z 10-30 userami z Biznesmisji
- Manual import pierwszych konwersji
- Validacja metrics dashboard

---

## Acceptance Criteria

System jest **production-ready** gdy:

- ✅ User na CompanyDetail klika "Kup AAPL przez XTB" → redirect działa, click_id zapisany
- ✅ Geo filtering działa (DE user nie widzi Bossy)
- ✅ Disclosure jest widoczne przy każdym CTA
- ✅ Admin może zaimportować CSV z conversions
- ✅ Dashboard pokazuje accurate metrics
- ✅ User settings pokazuje "Mój wpływ"
- ✅ Wszystko działa w 9 językach
- ✅ Mobile UX nie cierpi (CTA buttons accessible)
- ✅ CFD risk warning pokazuje się przy XTB i eToro

---

## Risk Mitigation

**Risk 1: Broker odmawia partnership**
- Mitigation: aplikuj do 4 jednocześnie. Jeśli któryś odrzuci, mamy 3 inne. eToro accept rate >90% dla legitimate apps.

**Risk 2: Click fraud / botowanie konkurencji**
- Mitigation: rate limiting per IP (max 10 clicks/h), bot detection (Cloudflare), fingerprinting

**Risk 3: Attribution windows różne dla różnych brokerów**
- Mitigation: zapisz `attribution_window_days` per conversion. XTB zwykle 30 dni, eToro 60 dni, Bossa 90 dni.

**Risk 4: Brokers zmieniają deep link format**
- Mitigation: config-driven approach. Marcin może zmienić template w admin UI bez deploy.

**Risk 5: Compliance audit (KNF, ESMA)**
- Mitigation: full audit trail w DB. Każdy click, każda disclosure shown jest logowana z timestamp.

---

## Notatka strategiczna

**Affiliate to Phase 1**. Cel: validate market, generate cash flow, learn user behavior.

**Insight który zdobędziesz:**
- Które rynki konwertują (PL? DE? US?)
- Które brokers konwertują (XTB lepiej dla GPW, eToro globalnie?)
- Które signal types generują clicks (premium analysis? signals page?)
- Jaki jest avg attribution window (jak szybko klik → konwersja?)

**Te dane podpowiedzą Ci** czy iść w Alpaca (US real trading) czy Lemon.markets (DACH) jako Phase 2.

---

*Specyfikacja v1.0 — May 2026*
*Status: Ready for Cursor implementation*
*Estimated timeline: 2-3 tygodnie do production-ready*
*Estimated revenue Y1: $30-50k*
