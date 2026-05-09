/** Indicative PLN→USD for UI hints (not a live FX feed; matches product copy). */
const PLN_PER_USD = 3.95;

export function localeTagForLanguage(i18nLanguage: string): string {
  const raw = i18nLanguage.trim().replace(/_/g, "-");
  if (!raw) return "en-US";
  if (raw.includes("-")) return raw;
  const map: Record<string, string> = {
    en: "en-GB",
    pl: "pl-PL",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    ja: "ja-JP",
    ko: "ko-KR",
    hi: "hi-IN",
  };
  return map[raw.toLowerCase()] ?? `${raw}-US`;
}

export function formatPlnAndUsd(pln: number, i18nLanguage: string): string {
  const locale = localeTagForLanguage(i18nLanguage);
  const plnStr = new Intl.NumberFormat(locale, { style: "currency", currency: "PLN", maximumFractionDigits: 2 }).format(pln);
  const usd = pln / PLN_PER_USD;
  const usdStr = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(usd);
  return `${plnStr} (~${usdStr})`;
}
