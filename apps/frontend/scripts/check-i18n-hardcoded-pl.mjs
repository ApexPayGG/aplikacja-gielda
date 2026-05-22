#!/usr/bin/env node
/**
 * Fails CI/local check when Polish user-facing strings are hardcoded in frontend src.
 * Run: npm run check:i18n
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "../src");

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

const POLISH_PHRASES = [
  "Brak ",
  "Zaznacz",
  "Pozycje",
  "Akcje",
  "Waluta:",
  "Waluta ",
  "Sprawdź",
  "Sprawdz",
  "Oceń",
  "Ostrzeżenie",
  "Ostrzezenie",
  "Koncentracja",
  "Korelacja",
  "Sektor",
  "Czas",
  "Portfela",
  "Psychiki",
  "Udostępnij",
  "Wybierz",
  "Chciwość",
  "Chciwosc",
  "Pewność",
  "Pewnosc",
  "Strach",
  "Ladowanie",
  "Ładowanie",
  "Zapisz ",
  "Anuluj",
  "Zamknij zaznaczone",
  "Potwierdź",
  "Uzupełnij",
  "Wprowadź",
  "Nie udało",
  "Nieprawidłowe",
  "Spółk",
  "spółk",
  "dziennik",
  "emocj",
  "psychik",
  "portfel",
  "Szacowana",
  "Laczna",
  "Biezaca",
  "Rozklad",
  "dywersyfikacja",
  "koncentracja",
  "otwartych",
  "zamknięcie",
  "Eksportuj",
  "Odznacz",
  "Sprzedaj",
  "Pozycja ",
  "Monitoruj",
  "Trzymaj",
  "Zabezpiecz",
  "Podnieś",
  "pilnuj",
  "Otwarto",
  "Zamknięto",
  "Mój ",
  "Twój ",
  "Niedźwiedzi",
  "Przegląd",
  "Powiadomień",
  "powiadomień",
  "Preferencje",
  "Język",
  "Usuń konto",
  "Mój profil",
  "Zmień avatar",
  "Imię",
  "Hasło",
  "Utwórz konto",
  "Zaloguj",
  "Rejestrując",
  "Politykę",
  "Korzyści",
  "Dołącz",
  "Wysyłanie",
  "wkrótce",
  "Minimalny wskaźnik",
  "Maksymalny wskaźnik",
  "Nie znaleziono spółki",
  "Zastrzeżenie",
  "Pełny regulamin",
  "Treści generowane",
  "Źródło:",
  "Typ (Kup",
  "Net sentiment: Sprzedaj",
  "Łączna wartość",
  "Wartość",
  "Globalny kryzys",
  "gwaltowne",
  "Pekniecie",
  "Wlasny scenariusz",
  "Scenariusz testu",
  "Szacowana zmiana",
  "Nowa wartosc",
  "Nowa wartość",
  "Ocen rozklad",
  "Udzial spolek",
  "Dobrze zdywersyfikowany",
  "Umiarkowana dywersyfikacja",
  "Wysoka koncentracja",
  "Liczba pozycji",
  "Wartosc portfela",
  "Rozklad sektorowy",
  "Centrum emocji",
  "Wybierz emocj",
  "Odpornosc na FOMO",
  "Kontrola chciwosci",
  "Cierpliwosc",
  "Udostepnij profil",
];

const POLISH_MONTH_DAY_NAMES = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
  "Piatek",
  "Sroda",
];

const SKIP_REL_PREFIXES = [
  "content/", // legal/policy static sections (locale-driven pages load separately)
];

const SKIP_REL_FILES = new Set([
  "constants/companyLegal.ts", // factual registered address in Poland
]);

const ALLOWLIST_LINE_PATTERNS = [
  /^\s*\/\//,
  /^\s*\/\*\*/,
  /^\s*\*/,
  /^\s*\*\//,
  /console\.(log|warn|error|debug)/,
  /import\s+.+\s+from/,
  /export\s+type/,
  /\/api\b/,
  /baseURL.*już/,
  /VITE_/,
  /mock-user/,
  /MOCK_/,
  /resolveIntlLocale/,
  /formatLocaleMonthYear/,
  /formatLocaleLongDate/,
  /formatLocaleDateTime/,
  /inferCurrencyFromSymbol/,
  /formatDividendPerShareAmount/,
];

const DEFAULT_VALUE_PL_RE =
  /defaultValue:\s*(['"`])([\s\S]*?)\1/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowlisted(line) {
  return ALLOWLIST_LINE_PATTERNS.some((re) => re.test(line));
}

function shouldSkipFile(rel) {
  if (SKIP_REL_FILES.has(rel)) return true;
  return SKIP_REL_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function textIncludesToken(text, token) {
  const trimmed = token.trim();
  if (!trimmed) return false;
  if (trimmed.length <= 4) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "u").test(text);
  }
  return text.includes(trimmed);
}

function polishHitsInText(text) {
  const hits = [];
  if (POLISH_DIACRITICS.test(text)) hits.push("polish-diacritics");
  for (const phrase of POLISH_PHRASES) {
    if (textIncludesToken(text, phrase)) {
      hits.push(`phrase:${phrase.trim()}`);
      break;
    }
  }
  for (const name of POLISH_MONTH_DAY_NAMES) {
    if (textIncludesToken(text, name)) {
      hits.push(`month-day:${name}`);
      break;
    }
  }
  return hits;
}

function findIssues(filePath, content) {
  const rel = path.relative(SRC_ROOT, filePath).replace(/\\/g, "/");
  if (shouldSkipFile(rel)) return [];
  const lines = content.split(/\r?\n/);
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAllowlisted(line)) continue;

    const hits = polishHitsInText(line);

    const defaultMatch = line.match(DEFAULT_VALUE_PL_RE);
    if (defaultMatch) {
      const defaultHits = polishHitsInText(defaultMatch[2]);
      for (const h of defaultHits) {
        if (!hits.includes(h)) hits.push(`defaultValue:${h}`);
      }
    }

    if (hits.length > 0) {
      issues.push({ rel, line: i + 1, hits, snippet: line.trim().slice(0, 140) });
    }
  }

  return issues;
}

const files = walk(SRC_ROOT);
const allIssues = files.flatMap((f) => findIssues(f, fs.readFileSync(f, "utf8")));

if (allIssues.length > 0) {
  console.error(`\n[i18n] Found ${allIssues.length} potential Polish hardcoded string(s) in apps/frontend/src:\n`);
  for (const issue of allIssues.slice(0, 80)) {
    console.error(`  ${issue.rel}:${issue.line} [${issue.hits.join(", ")}]`);
    console.error(`    ${issue.snippet}\n`);
  }
  if (allIssues.length > 80) {
    console.error(`  ... and ${allIssues.length - 80} more.\n`);
  }
  console.error(
    "Fix: use t('key', { defaultValue: 'English text' }) and add keys to public/locales/en/common.json\n",
  );
  process.exit(1);
}

console.log("[i18n] No Polish hardcoded strings detected in apps/frontend/src");
process.exit(0);
