import type { TFunction } from "i18next";

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

/** Normalized Polish rule text -> i18n key (English defaults in components). */
const KNOWN_TRADING_RULES: Record<string, string> = {
  "max 2 transakcje dziennie": "psyche.rules.max2PerDay",
  "nie handluj w piatek po 14:00": "psyche.rules.noFridayAfter14",
  "nie handluj w piątek po 14:00": "psyche.rules.noFridayAfter14",
  "stop loss zawsze przed wejsciem": "psyche.rules.stopLossBeforeEntry",
  "stop loss zawsze przed wejściem": "psyche.rules.stopLossBeforeEntry",
  "max 2 trades per day": "psyche.rules.max2PerDay",
  "no trading friday after 2 pm": "psyche.rules.noFridayAfter14",
  "do not trade after 2 pm on friday": "psyche.rules.noFridayAfter14",
  "stop loss always before entry": "psyche.rules.stopLossBeforeEntry",
};

const RULE_DEFAULTS_EN: Record<string, string> = {
  "psyche.rules.max2PerDay": "Max 2 trades per day",
  "psyche.rules.noFridayAfter14": "Do not trade after 2 PM on Friday",
  "psyche.rules.stopLossBeforeEntry": "Always set stop loss before entry",
};

const KNOWN_COACH_AI_PL: Record<string, string> = {
  "brak danych do analizy behawioralnej.": "coach.noBehavioralData",
  "brak danych do analizy behawioralnej": "coach.noBehavioralData",
};

const COACH_AI_DEFAULTS_EN: Record<string, string> = {
  "coach.noBehavioralData": "No behavioral data available yet.",
};

export function isUiLanguagePolish(language?: string): boolean {
  return (language ?? "en").trim().toLowerCase().startsWith("pl");
}

function normalizeRuleLookupKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function lookupTradingRuleKey(text: string): string | null {
  const key = normalizeRuleLookupKey(text);
  return KNOWN_TRADING_RULES[key] ?? null;
}

export function looksLikePolishText(text: string): boolean {
  if (POLISH_DIACRITICS.test(text)) return true;
  const lower = text.toLowerCase();
  return /\b(brak|transakcje|handluj|koncentracji|ostrzeg|waluta|pozycje|akcje|maj|piatek|piątek)\b/u.test(lower);
}

/** Map backend/local Polish trading rules to UI language via i18n keys. */
export function normalizeTradingRuleText(raw: string, t: TFunction, _language?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const ruleKey = lookupTradingRuleKey(trimmed);
  if (ruleKey) {
    return t(ruleKey, { defaultValue: RULE_DEFAULTS_EN[ruleKey] ?? trimmed });
  }

  return trimmed;
}

/** Replace known Polish coach API strings when UI language is English. */
export function normalizeCoachAiDescription(raw: string, t: TFunction, _language?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const lookup = normalizeRuleLookupKey(trimmed).replace(/\.$/, "");
  const coachKey = KNOWN_COACH_AI_PL[lookup] ?? KNOWN_COACH_AI_PL[`${lookup}.`];
  if (coachKey) {
    return t(coachKey, { defaultValue: COACH_AI_DEFAULTS_EN[coachKey] ?? trimmed });
  }

  return trimmed;
}
