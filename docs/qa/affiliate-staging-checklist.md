# Affiliate Integration - Staging QA Checklist

Ten dokument prowadzi krok po kroku przez QA Sprint 1 (affiliate).
Zakladany czas: 15-30 min.

## ⚡ Quick Run (5 min smoke test)

Use this BEFORE prod deploy decision. If all 7 pass -> deploy.
If any fails -> go to full checklist below to debug.

### 1. Migration

Co sprawdzam: czy migracja weszla i czy istnieja wszystkie 4 tabele affiliate.

```bash
npx prisma migrate deploy && psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('affiliate_brokers','affiliate_clicks','affiliate_conversions','affiliate_payouts') ORDER BY table_name;"
```

Expected: migracja bez bledow + 4 wiersze z nazwami tabel.

### 2. Verify seed

Co sprawdzam: czy seed ma 4 brokerow i domyslnie sa nieaktywni.

```bash
psql "$DB_URL" -c "SELECT slug, partner_id, is_active FROM affiliate_brokers WHERE slug IN ('xtb','bossa','etoro','trade_republic') ORDER BY slug;"
```

Expected: 4 brokers with `PENDING_*` (lub placeholder partner_id) i `is_active=false`.

### 3. GET /api/affiliate/brokers (geo PL)

Co sprawdzam: czy dla PL endpoint zwraca brokerow XTB/Bossa po ich aktywacji.

```bash
curl.exe -sS -X PATCH "$STAGING_API_BASE/admin/affiliate/brokers/xtb" -H "Content-Type: application/json" -d "{\"isActive\":true}" && curl.exe -sS -X PATCH "$STAGING_API_BASE/admin/affiliate/brokers/bossa" -H "Content-Type: application/json" -d "{\"isActive\":true}" && curl.exe -sS "$STAGING_API_BASE/affiliate/brokers?country=PL&market=US"
```

Expected: JSON `brokers[]` zawiera co najmniej `xtb` i `bossa`.

### 4. GET /api/affiliate/redirect (test click)

Co sprawdzam: czy redirect działa i tworzy klikniecie (tworzymy 2 klikniecia pod test CSV match).

```bash
curl.exe -i -sS "$STAGING_API_BASE/affiliate/redirect?broker=xtb&page=company_detail&ticker=AAPL&userId=qa-smoke-user" && curl.exe -i -sS "$STAGING_API_BASE/affiliate/redirect?broker=xtb&page=signals&ticker=MSFT&userId=qa-smoke-user"
```

Expected: 2x `HTTP/1.1 302` + `Location` header.

### 5. SQL check click record

Co sprawdzam: czy po redirect sa nowe rekordy w `affiliate_clicks`.

```bash
psql "$DB_URL" -c "SELECT click_id, user_id, source_page, source_ticker, clicked_at FROM affiliate_clicks WHERE user_id='qa-smoke-user' ORDER BY clicked_at DESC LIMIT 2;"
```

Expected: 2 najnowsze rekordy dla `qa-smoke-user`.

### 6. POST /api/admin/affiliate/import-csv (1 test CSV)

Co sprawdzam: czy import CSV zapisuje 3 konwersje i mapuje 2 rekordy do ostatnich click_id.

```bash
CLICK1=$(psql "$DB_URL" -t -A -c "SELECT click_id FROM affiliate_clicks WHERE user_id='qa-smoke-user' ORDER BY clicked_at DESC OFFSET 0 LIMIT 1;") && CLICK2=$(psql "$DB_URL" -t -A -c "SELECT click_id FROM affiliate_clicks WHERE user_id='qa-smoke-user' ORDER BY clicked_at DESC OFFSET 1 LIMIT 1;") && CSV_CONTENT=$(printf "external_user_id,conversion_type,conversion_date,commission_amount,commission_currency,ftd_amount,click_id_ref\nUSR_001,signup,2026-05-11,100.00,EUR,500.00,%s\nUSR_002,ftd,2026-05-10,150.00,EUR,1000.00,%s\nUSR_003,signup,2026-05-09,80.00,EUR,250.00,\n" "$CLICK1" "$CLICK2") && curl.exe -sS -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" -H "Content-Type: application/json" -d "{\"brokerSlug\":\"xtb\",\"csvContent\":\"$CSV_CONTENT\"}"
```

Expected: JSON z `imported:3` oraz `errors:[]`.

### 7. SQL check conversions (2 matched, 1 unmatched)

Co sprawdzam: czy w DB sa 3 nowe konwersje z poprawnym bilansem matched/unmatched.

```bash
psql "$DB_URL" -c "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE matched_click_id IS NOT NULL) AS matched, COUNT(*) FILTER (WHERE matched_click_id IS NULL) AS unmatched FROM affiliate_conversions WHERE external_user_id IN ('USR_001','USR_002','USR_003') AND conversion_date BETWEEN DATE '2026-05-09' AND DATE '2026-05-11';"
```

Expected: `total=3`, `matched=2`, `unmatched=1`.

## 0) Przygotowanie zmiennych

Ustaw sobie zmienne (PowerShell lub shell):

```bash
STAGING_API_BASE="https://YOUR-STAGING-DOMAIN/api"
DB_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
```

Przyklady IP do testow geo:

- PL: `83.27.176.1`
- DE: `91.64.0.1`
- US: `8.8.8.8`

---

## 1) Migracja na staging

### 1.1 Deploy kodu

- [ ] Upewnij sie, ze na staging jest commit `f1d8011b` (i poprzednie: `c48fb86a`, `13bdf387`).

### 1.2 Prisma migrate + generate + seed

- [ ] W katalogu `apps/api`:

```bash
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

- [ ] Oczekiwany efekt:
  - migracja `20260511163000_add_affiliate_tables` zastosowana,
  - seed tworzy 4 brokerow affiliate z `is_active=false`.

---

## 2) API E2E (curl / Postman)

Uwaga dla Windows: uzywaj `curl.exe` (nie aliasu PowerShell `curl`).

## 2.1 GET /api/affiliate/brokers (rozne geo)

### A) Wymuszenie geo query param (najprostsze)

```bash
curl.exe -sS "$STAGING_API_BASE/affiliate/brokers?country=PL&market=US"
curl.exe -sS "$STAGING_API_BASE/affiliate/brokers?country=DE&market=XETRA"
curl.exe -sS "$STAGING_API_BASE/affiliate/brokers?country=US&market=US"
```

- [ ] Sprawdz, ze odpowiedz ma pola: `country`, `market`, `defaultBroker`, `brokers[]`.
- [ ] Na starcie (seed `is_active=false`) oczekiwane: `brokers` puste.

### B) Wymuszenie geo przez header (test ipapi flow)

```bash
curl.exe -sS -H "X-Forwarded-For: 83.27.176.1" "$STAGING_API_BASE/affiliate/brokers?market=US"
curl.exe -sS -H "X-Forwarded-For: 91.64.0.1" "$STAGING_API_BASE/affiliate/brokers?market=XETRA"
```

- [ ] Potwierdz, ze `country` jest ustawione zgodnie z IP (jesli ipapi zwroci kod kraju).

## 2.2 GET /api/affiliate/redirect (click + DB record check)

Najpierw aktywuj jednego brokera (np. `xtb`) przez admin PATCH:

```bash
curl.exe -sS -X PATCH "$STAGING_API_BASE/admin/affiliate/brokers/xtb" ^
  -H "Content-Type: application/json" ^
  -d "{\"isActive\":true}"
```

Test redirect:

```bash
curl.exe -i -sS "$STAGING_API_BASE/affiliate/redirect?broker=xtb&page=company_detail&ticker=AAPL&signal=sig-test-001&userId=qa-user-1"
```

- [ ] Oczekiwane: `HTTP/1.1 302` + naglowek `Location`.
- [ ] `Location` powinien zawierac `partner_id` placeholder i `click_id/cid`.

Test anonymous click:

```bash
curl.exe -i -sS "$STAGING_API_BASE/affiliate/redirect?broker=xtb&page=signals&ticker=MSFT"
```

- [ ] Oczekiwane: `302`.
- [ ] W DB rekord z `user_id IS NULL`.

## 2.3 Admin CRUD /api/admin/affiliate/brokers

### Create

```bash
curl.exe -sS -X POST "$STAGING_API_BASE/admin/affiliate/brokers" ^
  -H "Content-Type: application/json" ^
  -d "{\"slug\":\"qa_broker\",\"displayName\":\"QA Broker\",\"partnerId\":\"qa_partner_001\",\"baseUrl\":\"https://example.com/?p={partner_id}&cid={click_id}\",\"supportedCountries\":[\"PL\",\"DE\"],\"supportedMarkets\":[\"US\"],\"attributionMethod\":\"click_id\",\"commissionModel\":\"cpa\",\"commissionCurrency\":\"EUR\",\"isActive\":true,\"priority\":55}"
```

### Read list

```bash
curl.exe -sS "$STAGING_API_BASE/admin/affiliate/brokers"
```

### Update

```bash
curl.exe -sS -X PATCH "$STAGING_API_BASE/admin/affiliate/brokers/qa_broker" ^
  -H "Content-Type: application/json" ^
  -d "{\"displayName\":\"QA Broker Updated\",\"isActive\":false,\"priority\":77}"
```

### Delete

```bash
curl.exe -sS -X DELETE "$STAGING_API_BASE/admin/affiliate/brokers/qa_broker"
```

- [ ] Sprawdz, ze create/update/delete odbijaja sie w kolejnych `GET`.

## 2.4 POST /api/admin/affiliate/import-csv (testowy CSV)

Przygotuj click (z pkt 2.2), zeby miec realny `click_id`.
Nastepnie import:

```bash
curl.exe -sS -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" ^
  -H "Content-Type: application/json" ^
  -d "{\"brokerSlug\":\"xtb\",\"csvContent\":\"click_id,conversion_type,commission_amount,currency,conversion_date,external_user_id\nREPLACE_WITH_CLICK_ID,ftd,120.50,EUR,2026-05-11,ext-user-123\"}"
```

- [ ] Oczekiwane: JSON z `imported`, `matched`, `unmatched`, `errors`.
- [ ] Dla poprawnego click_id: `matched` >= 1, `errors` = 0.

## 2.5 CSV Import Tests (per broker)

Najpierw wygeneruj pliki:

```bash
node docs/qa/generate-affiliate-test-csv.mjs
```

Pliki wynikowe:

- `docs/qa/test_data/xtb_test.csv`
- `docs/qa/test_data/bossa_test.csv`
- `docs/qa/test_data/etoro_test.csv`
- `docs/qa/test_data/trade_republic_test.csv`

Poniewaz aktualny endpoint oczekuje `json` z `csvContent`, wrzucamy zawartosc pliku jako string:

### XTB

```bash
CSV_CONTENT=$(cat docs/qa/test_data/xtb_test.csv)
curl -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" \
  -H "Content-Type: application/json" \
  -d "{\"brokerSlug\":\"xtb\",\"csvContent\":\"$CSV_CONTENT\"}"
```

### Bossa

```bash
CSV_CONTENT=$(cat docs/qa/test_data/bossa_test.csv)
curl -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" \
  -H "Content-Type: application/json" \
  -d "{\"brokerSlug\":\"bossa\",\"csvContent\":\"$CSV_CONTENT\"}"
```

### eToro

```bash
CSV_CONTENT=$(cat docs/qa/test_data/etoro_test.csv)
curl -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" \
  -H "Content-Type: application/json" \
  -d "{\"brokerSlug\":\"etoro\",\"csvContent\":\"$CSV_CONTENT\"}"
```

### Trade Republic

```bash
CSV_CONTENT=$(cat docs/qa/test_data/trade_republic_test.csv)
curl -X POST "$STAGING_API_BASE/admin/affiliate/import-csv" \
  -H "Content-Type: application/json" \
  -d "{\"brokerSlug\":\"trade_republic\",\"csvContent\":\"$CSV_CONTENT\"}"
```

Windows PowerShell wariant (zalecany na Twoim setupie):

```powershell
$csv = Get-Content "docs/qa/test_data/xtb_test.csv" -Raw
$body = @{ brokerSlug = "xtb"; csvContent = $csv } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method POST -Uri "$env:STAGING_API_BASE/admin/affiliate/import-csv" -ContentType "application/json" -Body $body
```

Postman wariant:

- Method: `POST`
- URL: `{{STAGING_API_BASE}}/admin/affiliate/import-csv`
- Body `raw` JSON:

```json
{
  "brokerSlug": "xtb",
  "csvContent": "....full CSV content..."
}
```

- [ ] Dla kazdego brokera oczekuj: `imported=3`.
- [ ] Trzeci rekord (pusty click id) powinien wejsc jako `unmatched`.

---

## 3) SQL weryfikacja DB

Uruchamiaj przez `psql` (lub klient DB):

```bash
psql "$DB_URL"
```

## 3.1 Czy affiliate_brokers ma 4 seedy

```sql
SELECT slug, display_name, is_active, priority
FROM affiliate_brokers
WHERE slug IN ('xtb', 'bossa', 'etoro', 'trade_republic')
ORDER BY priority ASC;
```

- [ ] 4 rekordy obecne.
- [ ] Domyslnie po seed: `is_active = false`.

## 3.2 Czy redirect zapisuje click record

```sql
SELECT click_id, user_id, broker_id, source_page, source_ticker, redirect_url, country_code, clicked_at
FROM affiliate_clicks
ORDER BY clicked_at DESC
LIMIT 20;
```

- [ ] Kazdy test redirect dodaje nowy rekord.
- [ ] `redirect_url` nie jest puste.

## 3.3 Czy CSV import matchuje click_id

```sql
SELECT
  acv.id,
  acv.click_id_ref,
  acv.matched_click_id,
  ac.click_id AS matched_click_value,
  ac.user_id AS click_user_id,
  acv.user_id AS conversion_user_id,
  acv.conversion_type,
  acv.commission_amount,
  acv.conversion_date
FROM affiliate_conversions acv
LEFT JOIN affiliate_clicks ac
  ON ac.id = acv.matched_click_id
ORDER BY acv.recorded_at DESC
LIMIT 20;
```

- [ ] Dla poprawnego importu: `click_id_ref` = testowy click_id.
- [ ] `matched_click_id` nie jest NULL.
- [ ] `conversion_user_id` zgodny z `click_user_id` (lub oba NULL dla anonymous click).

---

## 4) Frontend checklist

## 4.1 URL paths do otwarcia

- [ ] `https://YOUR-STAGING-DOMAIN/company/AAPL`
- [ ] `https://YOUR-STAGING-DOMAIN/signals`
- [ ] `https://YOUR-STAGING-DOMAIN/admin/affiliate`

## 4.2 CompanyDetail - co ma byc widoczne

- [ ] Pod wykresem widoczny `BrokerCTAButton` (gdy jest aktywny broker dla geolokalizacji/marketu).
- [ ] Przy CTA widoczny krótki `DisclosureNote`.
- [ ] Gdy brak aktywnego brokera -> CTA znika (brak buttona).

## 4.3 SignalsPage - co ma byc widoczne

- [ ] W panelu detalu sygnalu obok akcji jest CTA affiliate.
- [ ] CTA prowadzi do `/api/affiliate/redirect?...`.
- [ ] Widoczna notka disclosure.

## 4.4 Test 9 jezykow (jak przelaczyc + co sprawdzic)

- [ ] Przelaczaj jezyk przez `LanguageSwitcher` w navbar.
- [ ] Sprawdz locale: `pl`, `en`, `de`, `es`, `fr`, `hi`, `ja`, `ko`, `zh-TW`.
- [ ] W kazdym jezyku sprawdz klucze:
  - `affiliate.disclosure.short`
  - `affiliate.cta.buy_through`
  - `affiliate.cta.other_options`
  - `affiliate.modal.title`
- [ ] Upewnij sie, ze nie ma brakow typu surowy klucz i18n (`affiliate.xxx`).

## 4.5 Mobile view check

- [ ] Otworz DevTools -> iPhone/Android viewport.
- [ ] `CompanyDetail` i `SignalsPage`: CTA i disclosure sa czytelne i klikalne.
- [ ] Modal brokera miesci sie na ekranie i da sie zamknac.

---

## 5) Edge cases (must pass)

## 5.1 User z kraju bez dostepnego brokera

Kroki:

- [ ] Ustaw `is_active=true` tylko dla brokera z waskim `supported_countries` (np. tylko PL).
- [ ] Wywolaj `/api/affiliate/brokers?country=US`.
- [ ] Oczekiwane: `brokers=[]`, `defaultBroker=null`.
- [ ] Na froncie CTA ukryte.

## 5.2 Anonymous click (bez user_id)

Kroki:

- [ ] Wywolaj redirect bez `userId`.
- [ ] Oczekiwane: `302`.
- [ ] W `affiliate_clicks`: `user_id IS NULL`.

## 5.3 Broker `is_active=false`

Kroki:

- [ ] Ustaw brokerowi `isActive=false` przez admin PATCH.
- [ ] `/api/affiliate/brokers` nie zwraca tego brokera.
- [ ] `/company/:symbol` i `/signals`: brak CTA dla tego brokera (lub brak CTA w ogole, jesli nie ma innych aktywnych).

---

## 6) Cleanup po QA (opcjonalne)

- [ ] Usun testowego brokera `qa_broker` (jesli zostal utworzony).
- [ ] Przywroc docelowe flagi `is_active` zgodnie z planem rollout.
- [ ] Zostaw notatke z wynikami:
  - pass/fail per sekcja,
  - request/response dla ewentualnych faili,
  - screenshoty UI issue (jesli sa).
