import { useTranslation } from "react-i18next";
import { BrandLogo } from "./BrandLogo";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <BrandLogo size="loading" className="mx-auto" />
      <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-brandCyan border-t-transparent" />
      <p className="mt-4 text-sm text-textSecondary">{t("common.loading", { defaultValue: "Loading..." })}</p>
    </div>
  );
}
