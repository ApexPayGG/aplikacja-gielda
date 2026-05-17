import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { colors } from "../styles/designSystem";

type EtoroCTAButtonProps = {
  sourcePage: string;
  ticker?: string;
  signalId?: string;
  className?: string;
};

const ETORO_LINKS: Record<string, string> = {
  pl: "https://med.etoro.com/B9219_A129734_TClick_Sstockaipro-main.aspx",
  en: "https://med.etoro.com/B12087_A129734_TClick_Sstockaipro-main.aspx",
  fr: "https://med.etoro.com/B217_A129734_TClick_Sstockaipro-main.aspx",
  de: "https://med.etoro.com/B19298_A129734_TClick_Sstockaipro-main.aspx",
  es: "https://med.etoro.com/B210_A129734_TClick_Sstockaipro-main.aspx",
};

function normalizeLanguage(lang: string): string {
  const normalized = String(lang ?? "").trim().toLowerCase();
  if (!normalized) return "en";
  return normalized.split(/[-_]/)[0] || "en";
}

function getEtoroFallbackLink(lang: string): string {
  const normalizedLanguage = normalizeLanguage(lang);
  return ETORO_LINKS[normalizedLanguage] ?? ETORO_LINKS.en;
}

export function EtoroCTAButton({ sourcePage, ticker, signalId, className = "" }: EtoroCTAButtonProps) {
  const { t, i18n } = useTranslation("common");
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (): Promise<void> => {
    const lang = normalizeLanguage(i18n.resolvedLanguage || i18n.language || "en");
    const fallbackUrl = getEtoroFallbackLink(lang);
    if (isLoading) return;

    try {
      setIsLoading(true);
      const { data } = await api.post<{ url?: string }>("/affiliate/click", {
        broker: "etoro",
        lang,
        page: sourcePage,
        ticker,
        signalId,
      });
      const redirectUrl = typeof data?.url === "string" && data.url.trim() ? data.url : fallbackUrl;
      window.location.assign(redirectUrl);
    } catch {
      window.location.assign(fallbackUrl);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        style={{ backgroundColor: colors.brandDark, color: "#FFFFFF" }}
      >
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          eT
        </span>
        {isLoading
          ? t("common.loading", { defaultValue: "Loading..." })
          : t("etoro.cta", { defaultValue: "Open account on eToro" })}
      </button>
      <p className="text-xs" style={{ color: colors.textSecondary }}>
        {t("etoro.subtitle", { defaultValue: "Trade stocks through a licensed broker" })}
      </p>
    </div>
  );
}
