import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useUserAccess } from "../hooks/useUserAccess";

export function AccessBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { access, isLoading } = useUserAccess();

  if (isLoading || !access || user?.role === "ADMIN") {
    return null;
  }

  if (access.accessState === "TRIAL_ACTIVE") {
    const days = access.daysRemaining ?? 0;
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
        {t("accessBanner.trialActive", { days, defaultValue: "Trial active - {{days}} days left" })}
        {" / "}
        <Link to="/pricing" className="font-medium underline underline-offset-2">
          {t("accessBanner.viewPlans", { defaultValue: "View plans" })}
        </Link>
      </div>
    );
  }

  if (access.accessState === "TRIAL_EXPIRED" || access.accessState === "NO_ACCESS") {
    return (
      <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-100">
        {t("accessBanner.trialExpired", {
          defaultValue: "Your trial has ended. Choose a plan to continue.",
        })}{" "}
        <Link to="/pricing" className="font-medium underline underline-offset-2">
          {t("accessBanner.upgrade", { defaultValue: "Upgrade" })}
        </Link>
      </div>
    );
  }

  if (access.accessState === "SUBSCRIPTION_TRIALING") {
    return (
      <div className="border-b border-sky-500/20 bg-sky-500/10 px-4 py-2 text-center text-xs text-sky-100">
        {t("accessBanner.subscriptionTrialing", {
          defaultValue: "Subscription trial active",
        })}
      </div>
    );
  }

  return null;
}
