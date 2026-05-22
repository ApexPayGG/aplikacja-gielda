import { useTranslation } from "react-i18next";
import { LegalAccordion } from "../components/legal/LegalAccordion";
import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { COMPANY_ADDRESS_LINE, COMPANY_LEGAL } from "../constants/companyLegal";
import { privacyPolicySections } from "../content/privacyPolicySections";

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t("legal.privacyPageTitle", { defaultValue: "Privacy policy" })}
      documentLabel={t("legal.privacyDocumentLabel", { defaultValue: "GDPR" })}
      effectiveDate={COMPANY_LEGAL.privacyEffectiveDate}
      intro={
        <>
          <p>
            {t("legal.privacyIntro", {
              defaultValue:
                "This policy describes how {{company}} processes personal data of StockAI Pro users.",
              company: COMPANY_LEGAL.name,
            })}
          </p>
          <dl className="mt-4 grid gap-1 rounded-xl glass-panel border border-white/10 bg-white/5/50 p-4 text-sm">
            <div>
              <dt className="font-medium text-white">{t("legal.administrator", { defaultValue: "Controller" })}</dt>
              <dd>{COMPANY_LEGAL.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">{t("legal.address", { defaultValue: "Address" })}</dt>
              <dd>{COMPANY_ADDRESS_LINE}</dd>
            </div>
            <div>
              <dt className="font-medium text-white">{t("legal.email", { defaultValue: "Email" })}</dt>
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
