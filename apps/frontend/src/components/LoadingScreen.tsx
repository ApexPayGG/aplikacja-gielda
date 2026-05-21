import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { hasCompletedOnboarding } from "../utils/onboarding";
import { BrandLogo } from "./BrandLogo";

export function LoadingScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const glass = Boolean(token) && hasCompletedOnboarding();

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center ${
        glass ? "bg-[#0a0b14] text-white" : "bg-white"
      }`}
    >
      <BrandLogo size="loading" className="mx-auto" />
      <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-[#22d3ee] border-t-transparent" />
      <p className={`mt-4 text-sm ${glass ? "text-white/60" : "text-textSecondary"}`}>
        {t("common.loading", { defaultValue: "Loading..." })}
      </p>
    </div>
  );
}
