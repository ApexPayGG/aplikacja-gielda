import { useTranslation } from "react-i18next";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { TERMINAL_PANEL_MUTED, TERMINAL_TEXT_MUTED } from "../terminal/terminalStyles";

export function DividendHubDisclaimer() {
  const { t } = useTranslation();

  return (
    <aside
      className={`${TERMINAL_PANEL_MUTED} flex gap-3 p-4 sm:p-5`}
      role="note"
      aria-label={t("dividendHub.disclaimerAria", { defaultValue: "Dividend data disclaimer" })}
    >
      <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-terminal-cyan" aria-hidden />
      <div className={`space-y-1.5 text-sm leading-relaxed ${TERMINAL_TEXT_MUTED}`}>
        <p>
          {t("dividendHub.disclaimerLine1", {
            defaultValue: "Dividend data is for educational and informational analysis only.",
          })}
        </p>
        <p>
          {t("dividendHub.disclaimerLine2", {
            defaultValue:
              "Review dividend quality, payout risk and portfolio fit before making decisions.",
          })}
        </p>
      </div>
    </aside>
  );
}
