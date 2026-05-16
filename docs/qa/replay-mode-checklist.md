# Replay Mode QA Checklist

## UI flow (`/replay`)

- [ ] Otworz `/replay` i potwierdz, ze strona laduje sie bez bledow.
- [ ] Krok 1: wybierz symbol z dropdownu i ustaw date historyczna.
- [ ] Kliknij `Pobierz snapshot` i potwierdz widocznosc: `open`, `high`, `low`, `close`, `volume`, `priceChange5d`.
- [ ] Zweryfikuj, ze snapshot nie zawiera pustych pol, `NaN` ani `undefined`.
- [ ] Krok 3: ustaw `BUY`, wpisz cene > 0, kliknij `Ocen decyzje`.
- [ ] Potwierdz wynik AI: `score` (1-10), `explanation`, `actualOutcome`.
- [ ] Powtorz test dla `SELL` i innej ceny.
- [ ] Zmien symbol/date i potwierdz, ze poprzedni wynik AI zostal wyczyszczony po nowym snapshotcie.
- [ ] Sprawdz walidacje formularza (brak daty, brak symbolu, cena <= 0).
- [ ] Wymus blad API (np. brak danych) i potwierdz czytelny komunikat bledu.

## API smoke checks

- [ ] `GET /api/replay/snapshot?symbol=PKN&date=2025-01-15` zwraca `200` i wszystkie pola.
- [ ] `GET /api/replay/snapshot` bez parametrow zwraca `400`.
- [ ] `POST /api/replay/evaluate` z poprawnym body zwraca `200` oraz `{ score, explanation, actualOutcome }`.
- [ ] `POST /api/replay/evaluate` z `action=HOLD` zwraca `400`.

## Edge cases

- [ ] Data bez notowan lub bez danych +5 dni zwraca kontrolowany blad.
- [ ] Symbol w lowercase (np. `pkn`) jest poprawnie normalizowany.
- [ ] Brak `ANTHROPIC_API_KEY` zwraca jasny komunikat konfiguracyjny dla evaluate.
