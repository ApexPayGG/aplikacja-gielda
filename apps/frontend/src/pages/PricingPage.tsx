import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { colors } from "../styles/designSystem";
import {
  annualSavingsPercent,
  formatEurPrice,
  PRICING_PLANS,
  TRIAL_RULES,
} from "../config/pricing";

type BillingCycle = "monthly" | "yearly";

const FEATURE_KEYS = [
  "paperTrading",
  "journal",
  "premiumScanner",
  "behavioralCoach",
  "stressTests",
  "prioritySupport",
] as const;

const PLAN_FEATURE_ACCESS: Record<(typeof FEATURE_KEYS)[number], { free: boolean; pro: boolean; proPlus: boolean }> = {
  paperTrading: { free: true, pro: true, proPlus: true },
  journal: { free: true, pro: true, proPlus: true },
  premiumScanner: { free: false, pro: true, proPlus: true },
  behavioralCoach: { free: false, pro: true, proPlus: true },
  stressTests: { free: false, pro: false, proPlus: true },
  prioritySupport: { free: false, pro: false, proPlus: true },
};

function formatPlanPrice(plan: "pro" | "proPlus", billingCycle: BillingCycle): string {
  const planId = plan === "pro" ? "PRO" : "PRO_PLUS";
  return formatEurPrice(planId, billingCycle);
}

function PlanFeatureList({
  planKey,
  textClassName,
}: {
  planKey: "free" | "pro" | "proPlus";
  textClassName: string;
}) {
  const { t } = useTranslation("common");

  return (
    <ul className={`mt-5 space-y-3 ${textClassName}`}>
      {FEATURE_KEYS.map((featureKey) => {
        const included = PLAN_FEATURE_ACCESS[featureKey][planKey];
        return (
          <li key={featureKey} className="flex items-start gap-3 text-sm">
            <span style={{ color: included ? colors.positive : colors.textMuted }} className="mt-0.5 font-semibold">
              {included ? "✓" : "✕"}
            </span>
            <span>{t(`pricingPage.features.${featureKey}`, { defaultValue: featureKey })}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PricingPage() {
  const { t } = useTranslation("common");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const pricingNote = useMemo(
    () =>
      billingCycle === "yearly"
        ? t("pricingPage.billing.yearlyNote", {
            defaultValue: `Annual billing in EUR - save ~${annualSavingsPercent("PRO")}% on Pro, ~${annualSavingsPercent("PRO_PLUS")}% on Pro+.`,
          })
        : t("pricingPage.billing.monthlyNote", {
            defaultValue: "Switch plans or cancel anytime from your account.",
          }),
    [billingCycle, t],
  );

  const faqItems = useMemo(
    () => [
      {
        question: t("pricingPage.faq.cancel.question", { defaultValue: "Can I cancel anytime?" }),
        answer: t("pricingPage.faq.cancel.answer", {
          defaultValue: "Yes. Cancel from your account settings. Access stays active until the end of the billing period.",
        }),
      },
      {
        question: t("pricingPage.faq.trial.question", { defaultValue: "Is there a free trial?" }),
        answer: t("pricingPage.faq.trial.answer", {
          defaultValue: `Start with a ${TRIAL_RULES.without_card.days}-day Pro+ trial (no card) or ${TRIAL_RULES.with_card.days}-day trial with card that converts to your chosen plan.`,
        }),
      },
      {
        question: t("pricingPage.faq.payment.question", { defaultValue: "What payment methods do you accept?" }),
        answer: t("pricingPage.faq.payment.answer", {
          defaultValue: "Payments are processed by Stripe in EUR. Major cards and local methods supported by Stripe.",
        }),
      },
      {
        question: t("pricingPage.faq.security.question", { defaultValue: "Is my data secure?" }),
        answer: t("pricingPage.faq.security.answer", {
          defaultValue: "We use encryption in transit, least-privilege access, and regular security reviews.",
        }),
      },
      {
        question: t("pricingPage.faq.paper.question", { defaultValue: "What is paper trading?" }),
        answer: t("pricingPage.faq.paper.answer", {
          defaultValue:
            "Paper trading simulates investing on real market data without risking capital - ideal for practice.",
        }),
      },
    ],
    [t],
  );

  return (
    <div className="min-h-screen bg-bgSecondary glass-muted">
      <SEOHead
        title={t("pricingPage.seo.title", { defaultValue: "Pricing - StockAI Pro" })}
        description={t("pricingPage.seo.description", {
          defaultValue: "Trial-first EUR pricing: Pro €29/mo, Pro+ €59/mo, Investor OS €99/mo. AI investment research for international investors.",
        })}
      />
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            {t("pricingPage.title", { defaultValue: "Choose your plan" })}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base glass-muted md:text-lg">
            {t("pricingPage.subtitle", {
              defaultValue:
                "Start with a trial - no classic free plan. Upgrade when you're ready; cancel anytime.",
            })}
          </p>
        </header>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div
            className="inline-flex rounded-xl border p-1"
            style={{ borderColor: colors.brandCyan }}
            role="group"
            aria-label={t("pricingPage.billing.toggleLabel", { defaultValue: "Billing period" })}
          >
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className="rounded-lg px-5 py-2 text-sm font-semibold transition"
              style={{
                backgroundColor: billingCycle === "monthly" ? colors.brandCyan : "transparent",
                color: billingCycle === "monthly" ? colors.brandDark : colors.textSecondary,
              }}
              aria-pressed={billingCycle === "monthly"}
            >
              {t("pricingPage.billing.monthly", { defaultValue: "Monthly" })}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className="relative rounded-lg px-5 py-2 text-sm font-semibold transition"
              style={{
                backgroundColor: billingCycle === "yearly" ? colors.brandCyan : "transparent",
                color: billingCycle === "yearly" ? colors.brandDark : colors.textSecondary,
              }}
              aria-pressed={billingCycle === "yearly"}
            >
              {t("pricingPage.billing.yearly", { defaultValue: "Yearly" })}
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  backgroundColor: billingCycle === "yearly" ? colors.brandDark : colors.positive,
                  color: billingCycle === "yearly" ? colors.brandCyan : "#fff",
                }}
              >
                {t("pricingPage.billing.saveBadge", { defaultValue: "Save" })}
              </span>
            </button>
          </div>
          <p className="text-center text-sm text-white/50">{pricingNote}</p>
          <p className="max-w-xl text-center text-sm text-brandCyan">
            {t("pricingPage.checkoutMigration.banner", {
              defaultValue:
                "Checkout migration in progress - beta access only. EUR checkout is being migrated. Join the trial waitlist or contact us for beta access.",
            })}
          </p>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <article
            className="rounded-2xl border p-6 shadow-sm"
            style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
          >
            <h2 className="text-xl font-bold text-white">Trial</h2>
            <p className="mt-3 glass-page-title text-3xl">€0</p>
            <p className="mt-1 text-xs text-white/50">
              {t("pricingPage.plans.trial.duration", {
                defaultValue: `${TRIAL_RULES.without_card.days} days / Pro+ experience`,
              })}
            </p>
            <p className="mt-3 glass-muted text-sm">
              {t("pricingPage.plans.trial.tagline", {
                defaultValue: "Limited Pro+ access - no credit card required to start.",
              })}
            </p>
            <PlanFeatureList planKey="free" textClassName="glass-muted" />
            <Link
              to="/register"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-brandDark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brandMedium"
            >
              {t("pricingPage.plans.trial.cta", { defaultValue: "Start trial" })}
            </Link>
            <EtoroCTAButton sourcePage="pricing_page" className="mt-3" />
          </article>

          <article className="rounded-2xl border p-6 shadow-lg" style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Pro</h2>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                {t("pricingPage.plans.pro.popular", { defaultValue: "Most popular" })}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{formatPlanPrice("pro", billingCycle)}</p>
            <p className="mt-1 text-xs text-white/80">
              {billingCycle === "yearly"
                ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in EUR" })
                : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in EUR" })}
            </p>
            <p className="mt-3 text-sm text-white/90">{PRICING_PLANS.PRO.tagline}</p>
            <PlanFeatureList planKey="pro" textClassName="text-white/90" />
            <Link
              to="/waitlist"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#a855f7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bgSecondary"
            >
              {t("pricingPage.cta.startProTrialSoon", { defaultValue: "Start trial soon" })}
            </Link>
          </article>

          <article
            className="rounded-2xl border p-6 shadow-lg"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
              borderColor: colors.brandMedium,
            }}
          >
            <h2 className="text-xl font-bold text-white">Pro+</h2>
            <p className="mt-3 text-3xl font-bold text-white">{formatPlanPrice("proPlus", billingCycle)}</p>
            <p className="mt-1 text-xs text-white/80">
              {billingCycle === "yearly"
                ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in EUR" })
                : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in EUR" })}
            </p>
            <p className="mt-3 text-sm text-white/90">{PRICING_PLANS.PRO_PLUS.tagline}</p>
            <PlanFeatureList planKey="proPlus" textClassName="text-white/90" />
            <Link
              to="/waitlist"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#a855f7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bgSecondary"
            >
              {t("pricingPage.cta.startProPlusTrialSoon", { defaultValue: "Start Pro+ trial soon" })}
            </Link>
          </article>
        </section>

        <p className="mt-6 text-center text-sm text-white/50">
          {t("pricingPage.checkoutMigration.note", {
            defaultValue:
              "EUR checkout will be enabled after Stripe EUR Price IDs are configured. Beta access is currently manual.",
          })}{" "}
          <Link to="/contact" className="font-semibold text-brandCyan hover:underline">
            {t("pricingPage.checkoutMigration.contactLink", { defaultValue: "Contact us" })}
          </Link>
        </p>

        <section
          className="mt-8 rounded-2xl border p-6 text-center"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brandCyan">
            {t("pricingPage.investorOs.comingSoon", { defaultValue: "Coming soon" })}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{PRICING_PLANS.INVESTOR_OS.displayName}</h2>
          <p className="mt-2 text-sm text-white/80">{PRICING_PLANS.INVESTOR_OS.tagline}</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {formatEurPrice("INVESTOR_OS", billingCycle)}
          </p>
          <p className="mt-2 text-xs text-white/50">
            {t("pricingPage.investorOs.note", {
              defaultValue: "Checkout not available yet - documented in pricing config for PRICING.1.",
            })}
          </p>
        </section>

        <section className="mt-16 glass-section rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white">{t("pricingPage.faq.title", { defaultValue: "FAQ" })}</h2>
          <div className="mt-6 divide-y divide-border">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.question} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                    className="flex w-full items-center justify-between gap-4 py-2 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-white">{item.question}</span>
                    <span style={{ color: colors.brandCyan }} className="text-lg font-semibold">
                      {isOpen ? "-" : "+"}
                    </span>
                  </button>
                  {isOpen ? <p className="pr-8 glass-muted text-sm">{item.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
