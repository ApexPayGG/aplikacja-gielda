import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisclosureNote } from "../components/affiliate/DisclosureNote";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import {
  TerminalBadge,
  TerminalButton,
  TerminalCard,
  TerminalPage,
  TerminalSection,
} from "../components/terminal";
import { useAuth } from "../context/AuthContext";
import { createStripeCheckoutSession } from "../services/api";
import { EUR_CHECKOUT_ENABLED } from "../config/checkout";
import { ANALYTICS_EVENTS, analyticsFailureReason, trackConversionEvent } from "../utils/analytics";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import {
  annualSavingsPercent,
  formatEurPrice,
  PRICING_PLANS,
  TRIAL_RULES,
} from "../config/pricing";

type BillingCycle = "monthly" | "yearly";
type PaidPlan = "pro" | "pro_plus";

const FEATURE_KEYS = [
  "paperTrading",
  "journal",
  "premiumScanner",
  "behavioralCoach",
  "stressTests",
  "prioritySupport",
] as const;

const ETORO_BROKER = { slug: "etoro" } as const;

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

function PlanFeatureList({ planKey }: { planKey: "free" | "pro" | "proPlus" }) {
  const { t } = useTranslation("common");

  return (
    <ul className="mt-4 space-y-2">
      {FEATURE_KEYS.map((featureKey) => {
        const included = PLAN_FEATURE_ACCESS[featureKey][planKey];
        return (
          <li key={featureKey} className="flex items-start gap-2.5 text-xs leading-relaxed text-terminal-textSecondary">
            <span
              className={`mt-0.5 font-semibold ${included ? "text-terminal-positive" : "text-terminal-textMuted"}`}
            >
              {included ? "✓" : "–"}
            </span>
            <span>{t(`pricingPage.features.${featureKey}`, { defaultValue: featureKey })}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PricingPage() {
  const { t, i18n } = useTranslation("common");
  const pricingViewSent = useRef(false);
  const { token } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PaidPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isLoggedIn = Boolean(token);
  const checkoutEnabled = EUR_CHECKOUT_ENABLED;

  useEffect(() => {
    if (pricingViewSent.current) return;
    pricingViewSent.current = true;
    trackConversionEvent(ANALYTICS_EVENTS.PRICING_PAGE_VIEW, undefined, i18n.language);
  }, [i18n.language]);

  function handleBillingCycleChange(cycle: BillingCycle): void {
    if (billingCycle === cycle) return;
    setBillingCycle(cycle);
    trackConversionEvent(ANALYTICS_EVENTS.SELECT_BILLING_CYCLE, { cycle }, i18n.language);
  }

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
          defaultValue:
            "Payments are processed by Stripe in EUR. Pro and Pro+ plans support monthly and yearly billing.",
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

  const handleCheckout = async (plan: PaidPlan): Promise<void> => {
    if (!checkoutEnabled) return;

    setCheckoutError(null);

    if (!isLoggedIn) {
      navigate("/login", { state: { from: "/pricing", checkoutPlan: plan, billing: billingCycle } });
      return;
    }

    const userId = typeof window !== "undefined" ? window.localStorage.getItem("userId")?.trim() ?? "" : "";
    if (!userId) {
      navigate("/login", { state: { from: "/pricing", checkoutPlan: plan, billing: billingCycle } });
      return;
    }

    try {
      setCheckoutLoadingPlan(plan);
      window.localStorage.setItem("checkout_plan", plan);
      trackConversionEvent(
        ANALYTICS_EVENTS.SELECT_PLAN,
        { plan, billing: billingCycle },
        i18n.language,
      );
      trackConversionEvent(
        ANALYTICS_EVENTS.BEGIN_CHECKOUT,
        { plan, billing: billingCycle, currency: "EUR" },
        i18n.language,
      );
      const { url } = await createStripeCheckoutSession({
        userId,
        plan,
        billing: billingCycle,
      });
      window.location.href = url;
    } catch (error) {
      trackConversionEvent(
        ANALYTICS_EVENTS.BEGIN_CHECKOUT_FAILED,
        { plan, billing: billingCycle, reason: analyticsFailureReason(error) },
        i18n.language,
      );
      console.error("Failed to start Stripe checkout", error);
      const message = apiErrorMessage(error);
      setCheckoutError(
        message ||
          t("pricingPage.checkoutError", {
            defaultValue: "Could not start checkout. Please try again in a moment.",
          }),
      );
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const billingToggle = (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <div
        className="inline-flex rounded-lg border border-terminal-border p-1"
        role="group"
        aria-label={t("pricingPage.billing.toggleLabel", { defaultValue: "Billing period" })}
      >
        <button
          type="button"
          onClick={() => handleBillingCycleChange("monthly")}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
            billingCycle === "monthly"
              ? "bg-terminal-cyan text-terminal-buttonText"
              : "text-terminal-textSecondary hover:text-terminal-text"
          }`}
          aria-pressed={billingCycle === "monthly"}
        >
          {t("pricingPage.billing.monthly", { defaultValue: "Monthly" })}
        </button>
        <button
          type="button"
          onClick={() => handleBillingCycleChange("yearly")}
          className={`relative rounded-md px-4 py-1.5 text-xs font-semibold transition ${
            billingCycle === "yearly"
              ? "bg-terminal-cyan text-terminal-buttonText"
              : "text-terminal-textSecondary hover:text-terminal-text"
          }`}
          aria-pressed={billingCycle === "yearly"}
        >
          {t("pricingPage.billing.yearly", { defaultValue: "Yearly" })}
          <TerminalBadge variant="positive" className="ml-1.5 align-middle">
            {t("pricingPage.billing.saveBadge", { defaultValue: "Save" })}
          </TerminalBadge>
        </button>
      </div>
      <p className="max-w-xs text-center text-[11px] text-terminal-textMuted sm:text-right">{pricingNote}</p>
    </div>
  );

  const renderPlanCta = (plan: PaidPlan, label: string) => {
    if (checkoutEnabled) {
      return (
        <TerminalButton
          type="button"
          variant="primary"
          className="mt-6 w-full"
          disabled={checkoutLoadingPlan !== null}
          onClick={() => void handleCheckout(plan)}
        >
          {checkoutLoadingPlan === plan
            ? t("pricingPage.cta.redirecting", { defaultValue: "Redirecting..." })
            : label}
        </TerminalButton>
      );
    }

    return (
      <Link to={isLoggedIn ? "/contact" : "/login"} state={isLoggedIn ? undefined : { from: "/pricing" }}>
        <TerminalButton type="button" variant="outline" className="mt-6 w-full">
          {t("pricingPage.cta.signIn", { defaultValue: "Sign in to subscribe" })}
        </TerminalButton>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-terminal-bg via-[#070B16] to-terminal-bg text-terminal-text">
      <SEOHead
        title={t("pricingPage.seo.title", { defaultValue: "Pricing - StockAI Pro" })}
        description={t("pricingPage.seo.description", {
          defaultValue: "Trial-first EUR pricing: Pro €29/mo, Pro+ €59/mo, Investor OS €99/mo. AI investment research for international investors.",
        })}
      />

      <TerminalPage
        eyebrow="PRICING"
        title="Institutional-grade market intelligence. Retail price."
        subtitle="Start with a trial. Upgrade when ready. Cancel anytime."
        actions={billingToggle}
        className="pt-16 sm:pt-20 md:pt-24"
        contentClassName="space-y-8 pb-16"
      >
        {checkoutError ? (
          <p className="rounded-lg border border-terminal-negative/30 bg-terminal-negative/10 px-4 py-3 text-sm text-terminal-negative">
            {checkoutError}
          </p>
        ) : null}

        {!isLoggedIn ? (
          <p className="text-sm text-terminal-textSecondary">
            {t("pricingPage.signInHint", { defaultValue: "Already have an account?" })}{" "}
            <Link to="/login" state={{ from: "/pricing" }} className="font-semibold text-terminal-cyan hover:underline">
              {t("pricingPage.signInLink", { defaultValue: "Sign in" })}
            </Link>{" "}
            {t("pricingPage.signInHintSuffix", { defaultValue: "to subscribe with one click." })}
          </p>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <TerminalCard variant="default" className="flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-textMuted">Pro</p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-terminal-text">
                  {formatPlanPrice("pro", billingCycle)}
                </p>
                <p className="mt-1 text-[11px] text-terminal-textMuted">
                  {billingCycle === "yearly"
                    ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in EUR" })
                    : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in EUR" })}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-terminal-textSecondary">{PRICING_PLANS.PRO.tagline}</p>
            <PlanFeatureList planKey="pro" />
            {renderPlanCta("pro", t("pricingPage.cta.startProTrial", { defaultValue: "Start Pro trial" }))}
          </TerminalCard>

          <TerminalCard variant="cyan" className="flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-cyan">Pro+</p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-terminal-text">
                  {formatPlanPrice("proPlus", billingCycle)}
                </p>
                <p className="mt-1 text-[11px] text-terminal-textMuted">
                  {billingCycle === "yearly"
                    ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in EUR" })
                    : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in EUR" })}
                </p>
              </div>
              <TerminalBadge variant="ai">
                {t("pricingPage.plans.proPlus.popular", { defaultValue: "Most popular" })}
              </TerminalBadge>
            </div>
            <p className="mt-4 text-sm text-terminal-textSecondary">{PRICING_PLANS.PRO_PLUS.tagline}</p>
            <PlanFeatureList planKey="proPlus" />
            {renderPlanCta("pro_plus", t("pricingPage.cta.startProPlusTrial", { defaultValue: "Start Pro+ trial" }))}
          </TerminalCard>
        </section>

        <TerminalSection
          eyebrow="TRIAL"
          title={t("pricingPage.plans.trial.title", { defaultValue: "Two ways to start" })}
          subtitle={t("pricingPage.plans.trial.subtitle", {
            defaultValue: "Try the platform before committing to a paid plan.",
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TerminalCard variant="elevated" className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
                {t("pricingPage.plans.trial.noCardLabel", { defaultValue: "After registration" })}
              </p>
              <p className="mt-2 text-sm font-semibold text-terminal-text">
                {TRIAL_RULES.without_card.days}-day no-card trial
              </p>
              <p className="mt-2 text-xs leading-relaxed text-terminal-textSecondary">
                {t("pricingPage.plans.trial.noCardBody", {
                  defaultValue:
                    "Create an account and explore Pro+ features for 7 days. No payment method required.",
                })}
              </p>
            </TerminalCard>
            <TerminalCard variant="elevated" className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
                {t("pricingPage.plans.trial.cardLabel", { defaultValue: "Paid plan checkout" })}
              </p>
              <p className="mt-2 text-sm font-semibold text-terminal-text">
                {TRIAL_RULES.with_card.days}-day card trial
              </p>
              <p className="mt-2 text-xs leading-relaxed text-terminal-textSecondary">
                {t("pricingPage.plans.trial.cardBody", {
                  defaultValue:
                    "Start Pro or Pro+ via Stripe to unlock a 14-day trial, then billing begins unless you cancel.",
                })}
              </p>
            </TerminalCard>
          </div>
          <div className="mt-2 space-y-4 border-t border-terminal-borderMuted pt-6">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 sm:max-w-2xl">
              <Link to="/register" className="block">
                <TerminalButton variant="primary" className="h-11 w-full">
                  {t("pricingPage.plans.trial.cta", { defaultValue: "Start trial" })}
                </TerminalButton>
              </Link>
              <EtoroCTAButton
                sourcePage="pricing_page"
                className="[&>div:first-child]:hidden [&_button]:min-h-[44px] [&_button]:w-full"
              />
            </div>
            <div className="rounded-lg border border-terminal-borderMuted/70 bg-terminal-panelSecondary/40 p-3 text-[11px] leading-relaxed text-terminal-textMuted [&_.bg-surface-elevated]:bg-transparent [&_.border-surface-border]:border-0 [&_.font-semibold]:text-xs [&_.font-semibold]:text-terminal-textSecondary [&_.text-red-300]:text-terminal-negative/90 [&_.text-slate-300]:text-terminal-textMuted [&_.text-white]:text-terminal-textSecondary">
              <DisclosureNote broker={ETORO_BROKER} variant="full" />
            </div>
          </div>
        </TerminalSection>

        <TerminalCard variant="default" className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <TerminalBadge variant="soon">
                {t("pricingPage.investorOs.comingSoon", { defaultValue: "Coming soon" })}
              </TerminalBadge>
              <h2 className="mt-3 text-xl font-bold text-terminal-text">{PRICING_PLANS.INVESTOR_OS.displayName}</h2>
              <p className="mt-2 max-w-2xl text-sm text-terminal-textSecondary">
                {PRICING_PLANS.INVESTOR_OS.tagline}
              </p>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-terminal-textMuted">
              {formatEurPrice("INVESTOR_OS", billingCycle)}
            </p>
          </div>
          <p className="mt-4 text-xs text-terminal-textMuted">
            {t("pricingPage.investorOs.note", {
              defaultValue: "Investor OS is coming soon and is not available for checkout yet.",
            })}
          </p>
          <TerminalButton variant="outline" className="mt-4" disabled>
            {t("pricingPage.investorOs.cta", { defaultValue: "Notify me" })}
          </TerminalButton>
        </TerminalCard>

        <TerminalSection title={t("pricingPage.faq.title", { defaultValue: "FAQ" })}>
          <div className="divide-y divide-terminal-borderMuted">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.question} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                    className="flex w-full items-center justify-between gap-4 py-1 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-terminal-text">{item.question}</span>
                    <span className="text-lg font-semibold text-terminal-cyan">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen ? (
                    <p className="pr-8 pt-2 text-xs leading-relaxed text-terminal-textSecondary">{item.answer}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TerminalSection>
      </TerminalPage>
    </div>
  );
}
