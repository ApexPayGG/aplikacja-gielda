# AI Coach — locale / language (backend follow-up)

## Current production behavior

`GET /api/paper/coach/:userId` returns `aiDescription` generated or canned on the API.

When the user has no behavioral snapshot, the API currently returns a **Polish** string:

`Brak danych do analizy behawioralnej.`

See: `apps/api/src/modules/paperTrading/paperTradingModule.ts` (`getCoachSnapshot`).

## Frontend mitigation (this repo)

`normalizeCoachAiDescription()` in `src/utils/runtimeI18n.ts` maps known Polish API strings to `coach.noBehavioralData` when UI language is English.

This does **not** translate dynamic AI-generated Polish paragraphs from the backend.

## Recommended backend task

1. Accept `?lang=en|pl` or `Accept-Language` on `/api/paper/coach/:userId`.
2. Return `aiDescription` in the requested language (or always English when `lang=en`).
3. Replace hardcoded Polish empty state with i18n keys server-side or English default.
4. Pass `lang` into `coachAiDescription()` prompt when LLM is used.

No Prisma migration required for locale support.
