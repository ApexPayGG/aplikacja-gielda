import { useTranslation } from "react-i18next";

type LangOption = {
  code: string;
  shortCode: string;
  label: string;
  flag: string;
};

const options: LangOption[] = [
  { code: "pl", shortCode: "PL", label: "Polski", flag: "🇵🇱" },
  { code: "en", shortCode: "EN", label: "English", flag: "🇬🇧" },
  { code: "de", shortCode: "DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", shortCode: "ES", label: "Español", flag: "🇪🇸" },
  { code: "ja", shortCode: "JA", label: "日本語", flag: "🇯🇵" },
  { code: "hi", shortCode: "HI", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ko", shortCode: "KO", label: "한국어", flag: "🇰🇷" },
  { code: "zh-TW", shortCode: "ZH-TW", label: "繁體中文", flag: "🇹🇼" },
  { code: "fr", shortCode: "FR", label: "Français", flag: "🇫🇷" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const active = options.find((x) => i18n.resolvedLanguage?.startsWith(x.code));
  const value = active?.code ?? "en";

  const handleChange = async (next: string) => {
    await i18n.changeLanguage(next);
    localStorage.setItem("stockai.lang", next);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{active?.flag ?? "🇬🇧"}</span>
      <select
        value={value}
        onChange={(e) => void handleChange(e.target.value)}
        className="interactive-tilt rounded border border-brand-border/80 bg-brand-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand-blue"
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.flag} {opt.shortCode} - {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
