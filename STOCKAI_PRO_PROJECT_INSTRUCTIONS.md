# StockAI Pro - Project Instructions

**Document:** `STOCKAI_PRO_PROJECT_INSTRUCTIONS.md`  
**Owner:** Marcin Chłędzik / AMC Energy Sp. z o.o.  
**Production:** https://stock-ai.pro  
**Last updated:** May 19, 2026

Master context file for Cursor agents and contributors. For strategic product vision see `STOCKAI_PRO_STRATEGIC_BRIEF_v7_0.md`.

---

## STATUS May 19, 2026

- **47+ migracji Prisma** - schema aktualna (TimescaleDB hypertables, auth, notifications, behavioral, live quotes, affiliate, itd.)
- **Legal:** Privacy Policy + Terms (RODO) + AI disclaimers (`InvestmentDisclaimer`, `AIDisclaimer`, locale `legal.*` w `common.json`)
- **Behavioral coach sync z TimescaleDB** - `EmotionJournalEntry`, `PsycheSnapshot` (`apps/api/src/modules/behavioral/`, frontend hooks `useEmotionSync`, coach paper engine)
- **i18n fix** - bundled translations (`import.meta.glob` w `apps/frontend/src/i18n/index.ts`), synchronous init (`i18nReady` w `main.tsx`), override script `apps/frontend/scripts/fix-landing-i18n-overrides.mjs` (JA, DE, ES, FR, KO, HI, zh-TW)
- **Mobile audit** - landing i kluczowe flow responsywne (hero, nav drawer, pricing, footer)
- **Landing v4** - ticker bar, world clocks, hero fixes, language switcher z flagami (9 języków: PL, EN, DE, ES, JA, HI, KO, ZH-TW, FR)
- **Scheduler hardened** - BullMQ retry, weekday-only market jobs
- **TypeScript 0 errors** - `npm run build` frontend + API compile clean
- **SEO static fallbacks** - `apps/frontend/index.html` neutral English meta (nadpisywane przez `SEOHead.tsx` per route/locale)

---

## Monorepo layout

| Path | Role |
|------|------|
| `apps/api/` | Node 20, Express, Prisma, BullMQ workers, Claude AI |
| `apps/frontend/` | React 18, Vite, Tailwind, i18next, landing + app shell |
| `apps/frontend/public/locales/{lng}/common.json` | UI copy (bundled at build) |
| `.github/workflows/` | CI/CD, polygon ingest, deploy |

---

## Agent conventions

1. **Scope** - minimal diff; match existing patterns (AMC Energy design tokens, `useTranslation('common')`).
2. **i18n** - no hardcoded user-facing strings on landing; add keys to `en/common.json` then sync/override other locales.
3. **Legal** - never remove disclaimers; locale-specific `legal.investmentDisclaimer` required.
4. **Secrets** - never commit `.env`, API keys, or Stripe secrets.
5. **Verify** - run `npm run build` in `apps/frontend` and/or `apps/api` after substantive changes.
6. **Git** - commit only when asked; message style: `fix:`, `feat:`, `docs:` + short imperative summary.

---

## Stack (reference)

- **Backend:** TypeScript, Express, Prisma, TimescaleDB, Redis 7, BullMQ  
- **Frontend:** React 18, Vite 6, TailwindCSS, react-i18next, Zustand, React Query  
- **AI:** Claude Sonnet / Haiku (briefs, coach, psyche, premium analysis)  
- **Hosting:** Hetzner VPS, Docker, GitHub Actions deploy  

---

## Related docs

- `STOCKAI_PRO_STRATEGIC_BRIEF_v7_0.md` - product vision & roadmap  
- `SESSION_BRIEF_v1.7.0.md` - infrastructure & phase history  
- `README.md` - live ingest, Discord alerts, local verify steps  
- `docs/PRICING_EUR_MIGRATION.md` - EUR trial-first pricing model (PRICING.1)

---

## Pricing model (PRICING.1 - May 2026)

**Positioning:** International EUR trial-first SaaS. **No classic full Free plan.**

| Plan | Monthly | Yearly | Tagline |
|------|---------|--------|---------|
| Trial (no card) | - | 7 days | Limited Pro+ experience |
| Trial (with card) | - | 14 days | Pro+ -> converts to paid via Stripe |
| **Pro** | €29 | €290 | Know what is happening. |
| **Pro+** | €59 | €590 | Know what it means. |
| **Investor OS** | €99 | €990 | Know what it means for you. |

**Trial Expired Mode:** account remains; login + settings/billing/pricing only; core product features blocked (see `TRIAL_EXPIRED_ACCESS` in config).

**Source of truth:** `apps/api/src/config/pricing.ts` (canonical) / mirror `apps/frontend/src/config/pricing.ts`

**Not yet live:** EUR Stripe Price IDs (env placeholders only); checkout still uses legacy USD IDs until PRICING.2+.

**Future (documented only):** Single Premium Report €19 / AI Credits add-on / founding offers.
