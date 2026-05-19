export type LanguageOption = {
  code: string;
  shortCode: string;
  label: string;
  flag: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "pl", shortCode: "PL", label: "Polski", flag: "🇵🇱" },
  { code: "en", shortCode: "EN", label: "English", flag: "🇬🇧" },
  { code: "de", shortCode: "DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", shortCode: "ES", label: "Español", flag: "🇪🇸" },
  { code: "ja", shortCode: "JA", label: "日本語", flag: "🇯🇵" },
  { code: "hi", shortCode: "HI", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ko", shortCode: "KO", label: "한국어", flag: "🇰🇷" },
  { code: "zh-TW", shortCode: "ZH", label: "繁體中文", flag: "🇹🇼" },
  { code: "fr", shortCode: "FR", label: "Français", flag: "🇫🇷" },
];

export function resolveLanguageCode(resolved?: string): string {
  const normalized = String(resolved ?? "en").toLowerCase();
  const match = LANGUAGE_OPTIONS.find(
    (opt) => normalized === opt.code.toLowerCase() || normalized.startsWith(`${opt.code.toLowerCase()}-`),
  );
  return match?.code ?? "en";
}
