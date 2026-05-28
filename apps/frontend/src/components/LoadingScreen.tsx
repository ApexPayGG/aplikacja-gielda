import { useTranslation } from "react-i18next";
import { BrandLogo } from "./BrandLogo";
import { TERMINAL_APP_BG, TERMINAL_TEXT_MUTED } from "./terminal/terminalStyles";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col items-center justify-center ${TERMINAL_APP_BG}`}>
      <BrandLogo size="loading" className="mx-auto" />
      <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-terminal-cyan border-t-transparent" />
      <p className={`mt-4 ${TERMINAL_TEXT_MUTED}`}>
        {t("common.loading", { defaultValue: "Loading..." })}
      </p>
    </div>
  );
}
