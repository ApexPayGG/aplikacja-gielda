import { useTranslation } from "react-i18next";

type LangOption = {
  code: string;
  label: string;
  flag: string;
};

const options: LangOption[] = [
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
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
            {opt.flag} {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
