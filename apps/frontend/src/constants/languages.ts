export type LanguageOption = {
  code: string;
  shortCode: string;
  label: string;
  /** ISO 3166-1 alpha-2 for flag images */
  countryCode: string;
  flag: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "pl", shortCode: "PL", label: "Polski", countryCode: "pl", flag: "🇵🇱" },
  { code: "en", shortCode: "EN", label: "English", countryCode: "gb", flag: "🇬🇧" },
  { code: "de", shortCode: "DE", label: "Deutsch", countryCode: "de", flag: "🇩🇪" },
  { code: "es", shortCode: "ES", label: "Español", countryCode: "es", flag: "🇪🇸" },
  { code: "ja", shortCode: "JA", label: "日本語", countryCode: "jp", flag: "🇯🇵" },
  { code: "hi", shortCode: "HI", label: "हिन्दी", countryCode: "in", flag: "🇮🇳" },
  { code: "ko", shortCode: "KO", label: "한국어", countryCode: "kr", flag: "🇰🇷" },
  { code: "zh-TW", shortCode: "ZH", label: "繁體中文", countryCode: "tw", flag: "🇹🇼" },
  { code: "fr", shortCode: "FR", label: "Français", countryCode: "fr", flag: "🇫🇷" },
];

export function resolveLanguageCode(resolved?: string): string {
  const normalized = String(resolved ?? "en").toLowerCase();
  const match = LANGUAGE_OPTIONS.find(
    (opt) => normalized === opt.code.toLowerCase() || normalized.startsWith(`${opt.code.toLowerCase()}-`),
  );
  return match?.code ?? "en";
}
