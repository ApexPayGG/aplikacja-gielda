# Brief projektu — StockAI Pro  
## Sesja UX, Dashboard i motyw Glass (maj 2026)

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT BRIEF — StockAI Pro                                ║
║  Zakres: UX/UI, Dashboard, Glass Theme, API limits, GA4     ║
║  Produkcja: https://stock-ai.pro                            ║
║  Repo: ApexPayGG/aplikacja-gielda (branch: main)            ║
║  Data briefu: 20 maja 2026                                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 1. Cel i kontekst

W tej sesji celem było **ujednolicenie doświadczenia użytkownika** w zalogowanej aplikacji StockAI Pro:

- naprawa problemów zgłaszanych na produkcji (layout, błędy konsoli, rate limity),
- przebudowa **Panelu (Dashboard)** pod onboarding i codzienną pracę,
- wprowadzenie spójnego stylu **glass + gradient** (jak na stronie Behavioral Coach) na **całą aplikację po zalogowaniu**,
- poprawki backendu pod limity Premium / AI Brief i Stripe.

Brief obejmuje **całość pracy wykonanej w tej sesji** oraz kluczowe commity wypchnięte na `main`.

---

## 2. Podsumowanie wykonawcze

| Obszar | Status | Efekt dla użytkownika |
|--------|--------|----------------------|
| Motyw Glass (globalny, po logowaniu) | ✅ Wdrożony | Ciemne tło, gradient, szklane karty na wszystkich głównych stronach app |
| Dashboard + Daily Check-In | ✅ Wdrożony | Hero onboarding, sidebar check-in, statystyki glass |
| Navbar + wyszukiwarka | ✅ Wdrożony | Kompaktowy układ, search 240px, brak nachodzenia na menu |
| Strona O nas | ✅ Wdrożony | Minimalny layout, `support@stock-ai.pro`, bez danych osobowych |
| GA4 | ✅ Wdrożony | ID `G-XE45H4W6BW` w `index.html` |
| Limity API (Premium / AI Brief) | ✅ Wdrożony (kod) | FREE: 10 analiz Premium/mies.; AI Brief tylko na właściwych endpointach |
| Stripe checkout | ⚠️ Częściowo | Lepsze komunikaty błędów; na prod wymaga `STRIPE_*` w `.env` |
| Deploy | ✅ Auto (GitHub Actions → Hetzner) | Push na `main` → `git pull` + `docker-compose restart` |

---

## 3. Frontend — motyw Glass (główna zmiana wizualna)

### 3.1 Architektura motywu

Po zalogowaniu (z wyłączeniem `/onboarding`) cała aplikacja dostaje:

- klasę **`glass-app`** na `app-shell` (`App.tsx`),
- jednorazowe tło ambient (**`GlassAmbient`**) — rozmyte orby fiolet/cyan,
- ciemną nawigację (**`AppNavBar`** z propem `glass`),
- ciemną dolną nawigację mobilną (**`MobileBottomNav`**),
- globalne tokeny CSS w **`index.css`** (`.glass-section`, `.glass-panel`, `.glass-page-title`, style inputów).

**Pliki centralne:**

| Plik | Rola |
|------|------|
| `apps/frontend/src/index.css` | Klasa `.glass-app` + utility glass |
| `apps/frontend/src/App.tsx` | Włączenie motywu + ambient dla zalogowanych |
| `apps/frontend/src/components/behavioral-coach/glassStyles.ts` | Tokeny Tailwind (sekcje, przyciski, karty) |
| `apps/frontend/src/components/behavioral-coach/GlassPageShell.tsx` | Opcjonalna otoczka strony (max-width + padding) |
| `apps/frontend/src/components/behavioral-coach/GlassAmbient.tsx` | Tło z orbami |

### 3.2 Strony przerobione w pierwszej kolejności (wzorzec Coach)

- **`/dashboard`** — pełny glass: hero onboarding, stat cards, watchlist, sygnały, check-in w sidebarze
- **`/companies`** — filtry glass, karty spółek, wyszukiwarka `variant="glass"`
- **`/signals`** — karty sygnałów, filtry, disclaimer `drawer`
- **`/paper-trading`** — nagłówek, stat tiles, sekcje tabel (część inline styles usunięta)
- **`/position-size`** — formularz i wyniki w glass

### 3.3 Rozszerzenie globalne (cała aplikacja)

Commit **`de439497`** — batch na **40+ stronach** (`apps/frontend/src/pages/*`):

- skrypty: `apps/frontend/scripts/apply-glass-theme.mjs`, `strip-inline-glass.mjs`
- zamiana klas `bg-bgPrimary`, `text-brandDark`, `border-border` → klasy glass / `text-white`
- usuwanie inline `style={{ backgroundColor: colors.bgPrimary }}` tam, gdzie blokowało motyw
- PWA cache podbite do **`stockai-v6`**

**Strony nadal jasne (celowo):** landing, login, register, waitlist, forgot/reset password, payment success/cancel — flow marketingowy / auth.

### 3.4 Komponenty współdzielone zaktualizowane

- `CompaniesFilter.tsx`, `SignalsFilter.tsx` — panele filtrów glass
- `CompanyCard.tsx` — karty watchlist glass
- `DailyCheckInWidget.tsx` — prop `appearance="glass"`
- `CompanySearchAutocomplete.tsx` — `variant="glass"`
- `GlobalSearchBar.tsx` — prop `glass`
- `InvestmentDisclaimer.tsx` — wariant `drawer` + przycisk zwijania pod dark UI
- `LoadingScreen.tsx`, `AppLegalFooter.tsx` — wersja dark po logowaniu

### 3.5 Paleta i UX (glass)

- Tło: `#0D0D1A` → gradient `#1a0538` → `#0D0D1A`
- Akcent: `#00C9D4` (cyan), fiolet `#2D0A6B` / `#7A0F9E`
- Karty: `border-white/10`, `backdrop-blur`, delikatny gradient
- Trendy: `emerald-400` / `red-400` na ciemnym tle
- CTA: gradient purple (`GLASS_BTN_PRIMARY`), secondary/ghost cyan

---

## 4. Dashboard — funkcjonalność i UX

### 4.1 Hero onboarding (pusty watchlist)

Gdy użytkownik nie ma spółek na liście:

- sekcja hero z eyebrow, tytułem, 3 krokami,
- CTA: Przeglądaj spółki, Sygnały, Behavioral Coach,
- chipy popularnych tickerów: `AAPL.US`, `MSFT.US`, `NVDA.US`.

### 4.2 Statystyki (gdy jest watchlist)

4 kafelki: Active signals, On watchlist, Win rate, Positive streak — wyliczane z watchlisty (m.in. ruch ±2% jako „sygnał”).

### 4.3 Sidebar — Daily Check-In

- Widget **`DailyCheckInWidget`** (`compact`, `appearance="glass"`),
- Po zapisie check-inu: plan na dziś, notatka coacha, CTA do Coach i Paper Trading (bez chowania po 3 s).

### 4.4 Tłumaczenia

Klucze m.in. `dashboard.hero.*`, `checkin.done.*` w `apps/frontend/public/locales/*/common.json`.

---

## 5. Nawigacja i layout

### 5.1 AppNavBar (commit `2fd1ff1f` + glass)

- Kolejność: **logo → menu → search (240px) → akcje**
- `GlobalSearchBar`: `w-[240px] shrink-0 grow-0` — brak nachodzenia na „Strona główna”
- Usunięta podpowiedź skrótu `?` przy search
- Wersja glass: ciemny pasek, linki cyan/white, dropdowny `bg-[#1a0538]/95`

### 5.2 Landing hero spacing (`655408be`)

- Zmniejszony padding-top hero (`pt-20`), `items-start` — mniejsza luka pod navbar.

### 5.3 Logo (`2a7c73e6`, `dda3744e`)

- Większe logo w navbarze (84px), odświeżony asset, cache bust.

---

## 6. Strona O nas

Commit **`e291afab`**:

- Nowoczesny, minimalistyczny układ (biały — strona publiczna),
- Kontakt: **`support@stock-ai.pro`**,
- Usunięte: dane twórcy, stack technologiczny, zbędne sekcje osobowe.

---

## 7. Analityka — Google Analytics 4

Commit **`b665d5be`**:

- Zamiana placeholder `G-PLACEHOLDER` → **`G-XE45H4W6BW`**
- Skrypty gtag w `apps/frontend/index.html`
- Inicjalizacja po zgodzie cookies (`cookieConsent === "all"`) w `App.tsx`

---

## 8. Backend — limity, Stripe, AI Brief

### 8.1 Premium Analysis — limit miesięczny FREE

Plik: `apps/api/src/middleware/rateLimiter.ts`

- **`PREMIUM_FREE_MONTHLY_LIMIT = 10`** (wcześniej 3)
- PRO / PRO_PLUS: bez limitu miesięcznego w tym middleware
- Klucze Redis: `rate:premium:{YYYY-MM}:user:{id}` / `:ip:{ip}`

### 8.2 AI Brief — osobny limiter ścieżek

Plik: `apps/api/src/services/aiBriefRateLimit.ts`

- Limit AI Brief **nie** obejmuje już całego `/api/premium/*`
- Scoped paths:
  - `/api/analysis/:symbol`
  - `/api/brief/:symbol`
  - `/api/companies/:symbol/brief`
- Testy: `apps/api/src/services/__tests__/aiBriefRateLimit.test.ts`

### 8.3 Stripe

Pliki: `apps/api/src/modules/stripe/stripeModule.ts`, `apps/api/src/routes/stripe.ts`

- Czytelniejsze błędy 503/502 gdy brak `STRIPE_SECRET_KEY` / `STRIPE_*_PRICE_ID`
- Testy route: `apps/api/src/routes/__tests__/stripe.test.ts`

**Produkcja:** błąd checkout 500 zwykle = brak lub złe ID cen w env na VPS (nie limit AI Brief).

### 8.4 Pliki API zmienione (lokalnie / na main)

- `server.ts`, `routes/analysis.ts` — integracja limitów
- `middleware/__tests__/rateLimiter.test.ts` — test limitu 10/mies.

> **Uwaga:** `apps/api/.env` nigdy nie commitować — tylko VPS / lokalnie.

---

## 9. Błędy zgłoszone przez użytkownika — status

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| „Nic się nie zmieniło” po glass | Zmiany tylko lokalnie / cache PWA | Commity + push; hard refresh; unregister SW |
| Stary About na prod | Brak deploy / cache | Deploy z `main`; Ctrl+Shift+R |
| Stripe 500 | Brak env Stripe na serwerze | Ustawić `STRIPE_*` na Hetzner |
| Premium 429 | Osobny limit miesięczny | Podniesiony do 10/mies. dla FREE |
| AI Brief mylony z Premium | Zbyt szeroki rate limit | Scoped `aiBriefRateLimit` |
| Search nachodzi na menu | Szeroki search w navbarze | 240px + kolejność elementów |
| Deprecated Apple meta | Ostrzeżenie przeglądarki | Do osobnej poprawki w `index.html` jeśli nadal występuje |

---

## 10. Deploy i weryfikacja

### 10.1 Pipeline

`.github/workflows/deploy-prod.yml`:

- trigger: push na `main`
- SSH na Hetzner → `git pull` → `docker-compose restart`

### 10.2 Commity sesji (chronologicznie, najnowsze na górze)

```
de439497 feat(frontend): apply glass theme globally for logged-in app
886ae5e9 feat(frontend): extend glass gradient UI to companies, signals, paper trading, position calculator
aedc983f feat(frontend): glass gradient dashboard aligned with Behavioral Coach
e936d017 feat(frontend): dashboard onboarding hero, check-in sidebar, navbar search 240px
2fd1ff1f fix(frontend): compact app navbar layout with 240px search and full nav
e291afab fix(frontend): redesign About page and fix navbar search overlap
b665d5be feat: add GA4 tracking G-XE45H4W6BW
655408be fix: reduce hero top spacing below navbar (pt-20, align start)
```

### 10.3 Checklista testów po deploy

1. Zaloguj się → **Panel** — ciemne tło, glass karty, check-in z prawej
2. **Spółki** — filtry i karty glass; wyszukiwarka
3. **Sygnały** — karty i filtry glass
4. **Paper Trading** — ciemny nagłówek i staty (tabele mogą wymagać dalszego dopracowania)
5. **Kalkulator pozycji** — formularz glass
6. **Behavioral Coach** — bez podwójnego tła (ambient globalny)
7. Checkout PRO — jeśli 503, sprawdzić env Stripe na serwerze
8. DevTools → Application → **Unregister** service worker → odśwież (cache `stockai-v6`)

### 10.4 Dev lokalny

```bash
cd apps/frontend
npm run dev
# http://localhost:5173/dashboard
```

---

## 11. Co może wymagać dalszej pracy

Priorytet niski/średni — poza zakresem pełnego „100% glass” w każdym komponencie:

1. **Paper Trading** — tabele i formularz „Otwórz pozycję” (część nadal inline `colors.*`)
2. **Company Detail / Premium Analysis** — gęste inline styles (~40–60 wystąpień)
3. **Onboarding** — osobny flow; obecnie jasny panel (OK dla pierwszego uruchomienia)
4. **ThemeToggle** — dark/light przy globalnym glass może być mylący (rozważyć ukrycie w app)
5. **Stripe prod** — konfiguracja wszystkich `STRIPE_*_PRICE_ID` + webhook secret
6. **Apple meta tag** — deprecacja w konsoli
7. **Commit API** — upewnić się, że wszystkie zmiany `apps/api` są na `main` (część mogła być tylko lokalnie przed `aedc983f`)

---

## 12. Struktura repo (skrót)

```
apps/
  frontend/     React + Vite + Tailwind — UI, glass theme, strony
  api/          Express + Prisma — rate limits, Stripe, analysis
  frontend/scripts/
    apply-glass-theme.mjs   # batch zamiana klas na stronach
    strip-inline-glass.mjs  # usuwanie inline light styles
.github/workflows/
  deploy-prod.yml           # auto-deploy Hetzner
```

---

## 13. Kontakt i dokumentacja powiązana

- Produkcja: **https://stock-ai.pro**
- Support (About): **support@stock-ai.pro**
- Starsze briefy w repo: `SESSION_BRIEF_v1.7.0.md`, `STOCKAI_PRO_STRATEGIC_BRIEF_v7_0.md`, `apps/docs/FINAL_BRIEF_v1_9_0.md`

---

## 14. Jednozdaniowe podsumowanie

**StockAI Pro po tej sesji ma spójny, ciemny interfejs glass/gradient dla zalogowanych użytkowników, przebudowany Dashboard z onboardingiem i check-inem, naprawioną nawigację, stronę O nas i GA4, oraz rozdzielone limity API Premium vs AI Brief — z automatycznym deployem na Hetzner po pushu na `main`.**

---

*Brief wygenerowany na podstawie sesji rozwojowej (maj 2026) i historii git `main`.*
