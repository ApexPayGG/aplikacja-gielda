import { useTranslation } from "react-i18next";
import { LegalAccordion } from "../components/legal/LegalAccordion";
import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { COMPANY_LEGAL } from "../constants/companyLegal";
import { termsSections } from "../content/termsSections";

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t("legal.termsPageTitle", { defaultValue: "Terms of use" })}
      documentLabel={t("legal.termsDocumentLabel", { defaultValue: "Terms of service" })}
      effectiveDate={COMPANY_LEGAL.privacyEffectiveDate}
      intro={
        <p>
          {t("legal.termsIntro", {
            defaultValue:
              "These terms govern use of the StockAI Pro platform ({{website}}) provided by {{company}}. By using the Platform, you accept the conditions below.",
            website: COMPANY_LEGAL.website,
            company: COMPANY_LEGAL.name,
          })}
        </p>
      }
    >
      <LegalAccordion sections={termsSections} />
    </LegalPageLayout>
  );
}
