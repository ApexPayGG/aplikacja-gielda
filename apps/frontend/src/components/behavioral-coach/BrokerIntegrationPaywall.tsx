import { LockClosedIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { GLASS_BTN_GHOST, GLASS_SECTION } from "./glassStyles";
import { TERMINAL_BROKER_PANEL } from "../terminal/terminalStyles";

export function BrokerIntegrationPaywall() {
  const { t } = useTranslation();

  return (
    <section className={`${GLASS_SECTION} ${TERMINAL_BROKER_PANEL} relative overflow-hidden`}>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/10 text-terminal-cyan">
            <LockClosedIcon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-terminal-cyan">StockAI Pro+</p>
            <h2 className="mt-1 text-lg font-bold text-terminal-text">
              {t("coach.paywall.title", { defaultValue: "Live broker integration" })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-terminal-textSecondary">
              {t("coach.paywall.body", {
                defaultValue:
                  "Automatic broker API integration (e.g. eToro, Interactive Brokers) for live emotion analysis is available on the PRO+ plan.",
              })}
            </p>
          </div>
        </div>

        <Link to="/pricing" className={`shrink-0 gap-2 px-5 py-3 ${GLASS_BTN_GHOST}`}>
          <SparklesIcon className="h-4 w-4" aria-hidden />
          {t("coach.paywall.cta", { defaultValue: "Unlock PRO+" })}
        </Link>
      </div>
    </section>
  );
}
