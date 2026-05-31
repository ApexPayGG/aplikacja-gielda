import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_CARD,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_SECTION_TITLE,
} from "../terminal/terminalStyles";

type ToolPanelProps = {
  view: "intelligence" | "compound";
};

export function DividendHubToolPanel({ view }: ToolPanelProps) {
  const { t } = useTranslation();
  const isIntelligence = view === "intelligence";

  const title = isIntelligence
    ? t("dividendIntelligence.title", { defaultValue: "Dividend Intelligence" })
    : t("dividendcompound.title", { defaultValue: "Dividend Compound Calculator" });

  const body = isIntelligence
    ? t("dividendHub.intelligenceBody", {
        defaultValue:
          "Per-symbol safety score, trend direction, sector context and dividend alerts — for research, not trade instructions.",
      })
    : t("dividendHub.compoundBody", {
        defaultValue:
          "Simulate portfolio growth with dividend reinvestment versus cash payout using your own assumptions.",
      });

  const cta = isIntelligence
    ? t("dividendHub.intelligenceCta", { defaultValue: "Open dividend intelligence" })
    : t("dividendHub.compoundCta", { defaultValue: "Open compound calculator" });

  const to = isIntelligence ? "/dividend/intelligence" : "/dividend-compound";

  return (
    <section className={`${TERMINAL_CARD} space-y-4 p-6 sm:p-8`}>
      <div>
        <h2 className={TERMINAL_SECTION_TITLE}>{title}</h2>
        <p className={`mt-3 max-w-2xl ${TERMINAL_PAGE_SUBTITLE}`}>{body}</p>
      </div>
      <Link to={to} className={TERMINAL_BUTTON_PRIMARY}>
        {cta}
      </Link>
    </section>
  );
}
