import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

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
      className="relative scroll-mt-24 overflow-hidden px-4 py-20"
      aria-labelledby="landing-brief-demo-title"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span className="inline-flex rounded-full border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#22d3ee]">
          {t("landing.aiBriefDemo.badge")}
        </span>
        <h2 id="landing-brief-demo-title" className="section-h2 mt-4 text-white">
          {t("landing.aiBriefDemo.title")}
        </h2>
        <p className="landing-body mt-3 text-[#94a3b8]">{t("landing.aiBriefDemo.subtitle")}</p>
      </div>

      <article className="glass-section relative z-10 mx-auto mt-10 max-w-3xl p-6 sm:p-8">
        <header className="border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
            {t("landing.aiBriefDemo.symbolLabel")}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{t("landing.aiBriefDemo.symbol")}</p>
          <p className="mt-2 text-sm text-[#94a3b8]">{t("landing.aiBriefDemo.disclaimer")}</p>
        </header>

        {highlightList.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2">
            {highlightList.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 space-y-5">
          {sectionList.map((section) => (
            <div key={section.heading}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#22d3ee]">{section.heading}</h3>
              <p className="landing-body mt-2 text-[#94a3b8]">{section.body}</p>
            </div>
          ))}
        </div>

        <Link
          to="/register"
          className="mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-95 sm:w-auto"
          style={{ backgroundColor: "#a855f7" }}
        >
          {t("landing.aiBriefDemo.cta")} →
        </Link>
      </article>
    </section>
  );
}
