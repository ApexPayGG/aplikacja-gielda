import { useTranslation } from "react-i18next";
import { SEOHead } from "../components/SEOHead";
import {
  GLASS_HERO,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
} from "../components/behavioral-coach/glassStyles";

const SUPPORT_EMAIL = "support@stock-ai.pro";

export function AboutPage() {
  const { t } = useTranslation();

  const missionValues = [
    {
      titleKey: "aboutPage.valuePrecisionTitle",
      titleDefault: "Precision",
      descKey: "aboutPage.valuePrecisionDesc",
      descDefault: "Analysis driven by market data, not opinions or information noise.",
    },
    {
      titleKey: "aboutPage.valuePsychologyTitle",
      titleDefault: "Psychology",
      descKey: "aboutPage.valuePsychologyDesc",
      descDefault: "Behavioral coaching as the foundation of decisions — not an add-on to charts.",
    },
    {
      titleKey: "aboutPage.valueAccessTitle",
      titleDefault: "Accessibility",
      descKey: "aboutPage.valueAccessDesc",
      descDefault: "9 languages, 130+ exchanges, and a trial to get started.",
    },
  ] as const;

  return (
    <div className={GLASS_PAGE_BG}>
      <SEOHead
        title={t("aboutPage.seoTitle", { defaultValue: "About StockAI Pro" })}
        description={t("aboutPage.seoDescription", {
          defaultValue: "StockAI Pro mission: professional investing tools and behavioral coaching for retail investors.",
        })}
        ogType="website"
      />

      <main className="mx-auto max-w-3xl px-6 py-20 md:py-28 lg:py-32">
        <header className={GLASS_HERO}>
          <p className="text-sm font-medium uppercase tracking-widest text-[#94a3b8]">
            {t("aboutPage.brand", { defaultValue: "StockAI Pro" })}
          </p>
          <h1 className={`${GLASS_PAGE_TITLE} mt-4`}>
            {t("aboutPage.headline", { defaultValue: "We are building the tool we wished we had." })}
          </h1>
          <p className={`${GLASS_PAGE_SUBTITLE} mt-8 text-lg md:text-xl`}>
            {t("aboutPage.lead", {
              defaultValue:
                "We democratize access to professional investing tools. Retail investors deserve the same quality of analysis and decision support as institutions — without barriers and unnecessary complexity.",
            })}
          </p>
        </header>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {missionValues.map((item) => (
            <article key={item.titleKey} className={GLASS_SECTION}>
              <h2 className="text-lg font-semibold text-white">{t(item.titleKey, { defaultValue: item.titleDefault })}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{t(item.descKey, { defaultValue: item.descDefault })}</p>
            </article>
          ))}
        </div>

        <p className="mt-16 text-sm text-white/50">
          {t("aboutPage.contact", { defaultValue: "Questions? Email us at" })}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#22d3ee] hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
