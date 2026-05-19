import { LegalAccordion } from "../components/legal/LegalAccordion";
import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { COMPANY_LEGAL } from "../constants/companyLegal";
import { termsSections } from "../content/termsSections";

export function TermsPage() {
  return (
    <LegalPageLayout
      title="Regulamin użytkowania"
      documentLabel="Warunki korzystania"
      effectiveDate={COMPANY_LEGAL.privacyEffectiveDate}
      intro={
        <p>
          Regulamin określa zasady korzystania z platformy StockAI Pro ({COMPANY_LEGAL.website}) świadczonej przez{" "}
          {COMPANY_LEGAL.name}. Korzystając z Platformy, akceptujesz poniższe warunki.
        </p>
      }
    >
      <LegalAccordion sections={termsSections} />
    </LegalPageLayout>
  );
}
