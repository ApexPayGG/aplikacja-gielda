# MODEL_GUIDE

Praktyczna instrukcja doboru modeli dla projektu StockAI Pro.

## Domyślny model

- Używaj `Codex 5.3 Medium` jako głównego modelu do codziennej pracy:
  - feature development,
  - bugfixy,
  - testy,
  - lokalne refaktory.

To najlepszy balans: jakość / szybkość / zużycie tokenów.

## Kiedy przełączyć na mocniejszy model

Przełącz na mocniejszy model (np. `Opus 4.7` albo `Sonnet 4.6`) gdy:

- utknąłeś po 2-3 próbach naprawy tego samego błędu,
- podejmujesz decyzję architektoniczną (kolejki, cache, migracje, security),
- robisz duży refactor z wysokim ryzykiem regresji,
- robisz finalny, krytyczny review przed deployem.

## Kiedy wrócić na model domyślny

Wróć na `Codex 5.3 Medium`, gdy:

- znasz już root cause,
- masz konkretny plan zmian,
- zostało wdrożenie i iteracyjne poprawki.

## Reguła eskalacji (prosta)

1. Start: `Codex 5.3 Medium`
2. Blokada/duża decyzja: przełącz na mocniejszy model
3. Po rozwiązaniu problemu: wróć na `Codex 5.3 Medium`

Nie utrzymuj drogich modeli przez cały czas trwania sesji.

## Sygnały, że przepalasz tokeny

- odpowiedzi są długie, ale bez nowych decyzji,
- dużo teorii, mało realnych zmian w plikach,
- kilka iteracji bez postępu.

Wtedy:

- skróć prompt,
- zawęź zakres plików,
- wróć na model domyślny.

## Szablon promptu (oszczędny i skuteczny)

Używaj struktury:

- Cel (co ma działać po zmianie)
- Zakres (jakie pliki wolno ruszyć)
- Warunki (testy/lint/edge cases)
- Wynik (co zwrócić po wykonaniu)

Przykład:

`Napraw retry DLQ w plikach A i B. Nie zmieniaj C. Po zmianie uruchom testy X i Y. Zwróć krótkie podsumowanie i ryzyka.`

## Szybka mapa modeli dla StockAI

- Codzienna implementacja: `Codex 5.3 Medium`
- Trudny bug produkcyjny: `Opus 4.7` (diagnoza), potem powrót
- Review przed merge: `Sonnet 4.6` lub `Opus 4.7`
- Mockupy/grafiki: model/sesja z włączonym image generation

## Operacyjna zasada zespołu

Traktuj mocny model jako narzędzie do:

- decyzji,
- diagnozy,
- review ryzyka.

Traktuj model domyślny jako narzędzie do:

- dowożenia zmian,
- iteracji,
- finalizacji pracy.
