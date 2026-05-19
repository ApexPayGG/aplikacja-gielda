import { useTranslation } from "react-i18next";
import { CountryFlag } from "./CountryFlag";
import { LANGUAGE_OPTIONS, resolveLanguageCode } from "../constants/languages";

type LanguageSwitcherProps = {
  variant?: "default" | "landing";
};

export default function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation("common");
  const value = resolveLanguageCode(i18n.resolvedLanguage);
  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === value) ?? LANGUAGE_OPTIONS[1];

  const handleChange = async (next: string) => {
    await i18n.changeLanguage(next);
    localStorage.setItem("stockai.lang", next);
  };

  if (variant === "landing") {
    return (
      <div className="relative inline-flex items-center">
        <CountryFlag
          countryCode={currentOption.countryCode}
          className="pointer-events-none absolute left-2.5 z-10 h-3.5 w-[1.35rem] rounded-[2px] object-cover"
          title={currentOption.label}
        />
        <select
          value={value}
          onChange={(e) => void handleChange(e.target.value)}
          aria-label="Language selector"
          className="cursor-pointer appearance-none rounded-lg border border-[#2D0A6B]/15 bg-transparent py-1.5 pl-9 pr-8 text-sm font-semibold text-[#2D0A6B] outline-none transition hover:border-[#2D0A6B]/30 focus:border-[#00C9D4]/50"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CountryFlag countryCode={currentOption.countryCode} title={currentOption.label} />
      <select
        value={value}
        onChange={(e) => void handleChange(e.target.value)}
        aria-label="Language selector"
        className="interactive-tilt rounded border border-brand-border/80 bg-brand-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand-blue"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
