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

type LanguageSwitcherProps = {
  variant?: "default" | "landing";
};

export default function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const active = options.find((x) => i18n.resolvedLanguage?.startsWith(x.code));
  const value = active?.code ?? "en";

  const handleChange = async (next: string) => {
    await i18n.changeLanguage(next);
    localStorage.setItem("stockai.lang", next);
  };

  if (variant === "landing") {
    return (
      <div className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-3 text-sm" aria-hidden>
          🌐
        </span>
        <select
          value={value}
          onChange={(e) => void handleChange(e.target.value)}
          aria-label="Language selector"
          className="cursor-pointer appearance-none rounded-lg border border-[#2D0A6B]/15 bg-transparent py-1.5 pl-9 pr-8 text-sm font-semibold text-[#2D0A6B] outline-none transition hover:border-[#2D0A6B]/30 focus:border-[#00C9D4]/50"
        >
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.shortCode}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <select
        value={value}
        onChange={(e) => void handleChange(e.target.value)}
        aria-label="Language selector"
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
