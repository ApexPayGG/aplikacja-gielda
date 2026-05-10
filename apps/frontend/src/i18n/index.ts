import i18n from "i18next";
import type { i18n as I18nApi } from "i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const supportedLngs = ["pl", "en", "de", "es", "ja", "hi", "ko", "zh-TW", "fr"] as const;

/** Persisted UI language (`LanguageSwitcher` writes `stockai.lang`). */
export function readStoredStockAiLang(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem("stockai.lang")?.trim();
  if (raw && (supportedLngs as readonly string[]).includes(raw)) return raw;
  return undefined;
}

/**
 * Pick locale for client-side copy fixes (e.g. replacing canned English API text).
 * If i18n is still on default `en` before async detection finishes, trust `stockai.lang`.
 */
export function resolveUiLocaleForCopy(i18next: I18nApi): string {
  const lang = (i18next.language || "").trim();
  const res = (i18next.resolvedLanguage || "").trim();
  const stored = readStoredStockAiLang();
  if (lang && lang !== "en") return lang;
  if (res && res !== "en") return res;
  if (stored && stored !== "en") return stored;
  return (lang || res || "en").trim();
}

void i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: [...supportedLngs],
    fallbackLng: "en",
    lng: readStoredStockAiLang() ?? "en",
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "stockai.lang",
      caches: ["localStorage"],
    },
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    react: {
      useSuspense: false,
      bindI18n: "languageChanged loaded",
      bindI18nStore: "added removed",
    },
  });

export default i18n;
