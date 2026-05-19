import i18n from "i18next";
import type { i18n as I18nApi, Resource } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const supportedLngs = ["pl", "en", "de", "es", "ja", "hi", "ko", "zh-TW", "fr"] as const;

/** Eagerly bundle every `public/locales/<lng>/common.json` — avoids raw keys when HTTP locale fetch fails. */
const localeModules = import.meta.glob("../../public/locales/*/common.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

function buildBundledResources(): Resource {
  const resources: Resource = {};
  for (const [path, data] of Object.entries(localeModules)) {
    const lng = path.match(/locales\/(.+?)\/common\.json$/)?.[1];
    if (!lng || !data) continue;
    resources[lng] = { common: data };
  }
  return resources;
}

const bundledResources = buildBundledResources();

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

const initialLng = readStoredStockAiLang() ?? "en";

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: [...supportedLngs],
    fallbackLng: "en",
    lng: initialLng,
    defaultNS: "common",
    ns: ["common"],
    resources: bundledResources,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    returnNull: false,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "stockai.lang",
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
      bindI18n: "languageChanged loaded",
      bindI18nStore: "added removed",
    },
  });

export default i18n;
