import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TERMINAL_BUTTON_PRIMARY, TERMINAL_DANGER_TEXT, TERMINAL_LINK_ACCENT } from "../terminal/terminalStyles";

export function DividendHubAccessGate({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 px-4 py-6 text-center">
      <p className={`text-sm ${TERMINAL_DANGER_TEXT}`}>{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/login" className={`${TERMINAL_BUTTON_PRIMARY} px-4 py-2 text-xs`}>
          {t("dividendHub.signInCta", { defaultValue: "Sign in" })}
        </Link>
        <Link to="/pricing" className={`text-xs font-semibold ${TERMINAL_LINK_ACCENT}`}>
          {t("dividendHub.pricingCta", { defaultValue: "View plans" })}
        </Link>
      </div>
    </div>
  );
}
