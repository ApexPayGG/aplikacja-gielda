import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  TERMINAL_LANDING_CTA_PRIMARY,
  TERMINAL_LANDING_EYEBROW,
  TERMINAL_LANDING_SECTION,
  TERMINAL_PROOF_CARD,
} from "../terminal/terminalStyles";

type BriefSection = { heading: string; body: string };

export function LandingAiBriefPreview() {
  const { t } = useTranslation("common");

  const sections = t("landing.aiBriefDemo.sections", { returnObjects: true });
  const sectionList: BriefSection[] = Array.isArray(sections)
    ? sections.filter(
        (item): item is BriefSection =>
          typeof item === "object" &&
          item !== null &&
          "heading" in item &&
          "body" in item &&
          typeof (item as BriefSection).heading === "string" &&
          typeof (item as BriefSection).body === "string",
      )
    : [];

  const highlights = t("landing.aiBriefDemo.highlights", { returnObjects: true });
  const highlightList: string[] = Array.isArray(highlights)
    ? highlights.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <section
      id="ai-brief-demo"
      className={`${TERMINAL_LANDING_SECTION}`}
      aria-labelledby="landing-brief-demo-title"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span className={TERMINAL_LANDING_EYEBROW}>{t("landing.aiBriefDemo.badge")}</span>
        <h2 id="landing-brief-demo-title" className="section-h2 mt-4 text-terminal-text">
          {t("landing.aiBriefDemo.title")}
        </h2>
        <p className="landing-body mt-3 text-terminal-textSecondary">{t("landing.aiBriefDemo.subtitle")}</p>
      </div>

      <article className={`${TERMINAL_PROOF_CARD} relative z-10 mx-auto mt-10 max-w-3xl p-6 sm:p-8`}>
        <header className="border-b border-terminal-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-terminal-textMuted">
            {t("landing.aiBriefDemo.symbolLabel")}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-terminal-text">{t("landing.aiBriefDemo.symbol")}</p>
          <p className="mt-2 text-sm text-terminal-textSecondary">{t("landing.aiBriefDemo.disclaimer")}</p>
        </header>

        {highlightList.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2">
            {highlightList.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-3 py-1 text-xs font-medium text-terminal-textSecondary"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 space-y-5">
          {sectionList.map((section) => (
            <div key={section.heading}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-terminal-cyan">{section.heading}</h3>
              <p className="landing-body mt-2 text-terminal-textSecondary">{section.body}</p>
            </div>
          ))}
        </div>

        <Link to="/register" className={`mt-8 ${TERMINAL_LANDING_CTA_PRIMARY}`}>
          {t("landing.aiBriefDemo.cta")} →
        </Link>
      </article>
    </section>
  );
}
