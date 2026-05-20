import { LegalAccordion } from "../components/legal/LegalAccordion";
import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { COMPANY_ADDRESS_LINE, COMPANY_LEGAL } from "../constants/companyLegal";
import { privacyPolicySections } from "../content/privacyPolicySections";

export function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Polityka prywatności"
      documentLabel="RODO / GDPR"
      effectiveDate={COMPANY_LEGAL.privacyEffectiveDate}
      intro={
        <>
          <p>
            Niniejsza polityka opisuje, jak {COMPANY_LEGAL.name} przetwarza dane osobowe użytkowników StockAI Pro.
          </p>
          <dl className="mt-4 grid gap-1 rounded-xl glass-panel border border-white/10 bg-white/5/50 p-4 text-sm">
            <div>
              <dt className="font-medium text-white">Administrator</dt>
              <dd>{COMPANY_LEGAL.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Adres</dt>
              <dd>{COMPANY_ADDRESS_LINE}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Email</dt>
              <dd>
                <a href={`mailto:${COMPANY_LEGAL.privacyEmail}`} className="text-brandCyan hover:underline">
                  {COMPANY_LEGAL.privacyEmail}
                </a>
              </dd>
            </div>
          </dl>
        </>
      }
    >
      <LegalAccordion sections={privacyPolicySections} />
    </LegalPageLayout>
  );
}
