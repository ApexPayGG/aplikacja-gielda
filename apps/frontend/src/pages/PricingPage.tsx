import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { useAuth } from "../context/AuthContext";
import { createStripeCheckoutSession } from "../services/api";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";
import { apiErrorMessage } from "../utils/apiErrorMessage";

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

const PLAN_FEATURE_ACCESS: Record<(typeof FEATURE_KEYS)[number], { free: boolean; pro: boolean; proPlus: boolean }> = {
  paperTrading: { free: true, pro: true, proPlus: true },
  journal: { free: true, pro: true, proPlus: true },
  premiumScanner: { free: false, pro: true, proPlus: true },
  behavioralCoach: { free: false, pro: true, proPlus: true },
  stressTests: { free: false, pro: false, proPlus: true },
  prioritySupport: { free: false, pro: false, proPlus: true },
};

function formatUsdPrice(plan: "free" | "pro" | "proPlus", billingCycle: BillingCycle): string {
  if (plan === "free") return "$0/mo";
  if (plan === "pro") return billingCycle === "monthly" ? "$9/mo" : "$79/yr";
  return billingCycle === "monthly" ? "$19/mo" : "$149/yr";
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
  const { token } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PaidPlan | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const isLoggedIn = Boolean(token);

  const pricingNote = useMemo(
    () =>
      billingCycle === "yearly"
        ? t("pricingPage.billing.yearlyNote", {
            defaultValue: "Annual billing — save vs paying monthly (Pro ~27%, Pro+ ~35%).",
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
          defaultValue: "Pro includes a 14-day trial so you can test full features before committing.",
        }),
      },
      {
        question: t("pricingPage.faq.payment.question", { defaultValue: "What payment methods do you accept?" }),
        answer: t("pricingPage.faq.payment.answer", {
          defaultValue: "Payments are processed by Stripe (USD). Major cards and local methods supported by Stripe.",
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
            "Paper trading simulates investing on real market data without risking capital — ideal for practice.",
        }),
      },
    ],
    [t],
  );

  const handleCheckout = async (plan: PaidPlan): Promise<void> => {
    setCheckoutError(null);

    if (!isLoggedIn) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }

    const userId = typeof window !== "undefined" ? window.localStorage.getItem("userId")?.trim() ?? "" : "";
    if (!userId) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }

    try {
      setCheckoutLoadingPlan(plan);
      window.localStorage.setItem("checkout_plan", plan);
      trackEvent("begin_checkout", { plan, billing: billingCycle });
      const { url } = await createStripeCheckoutSession({
        userId,
        plan,
        billing: billingCycle,
      });
      window.location.href = url;
    } catch (error) {
      console.error("Failed to start Stripe checkout", error);
      setCheckoutError(
        apiErrorMessage(error) ||
          t("pricingPage.checkoutError", {
            defaultValue: "Could not start checkout. Please try again in a moment.",
          }),
      );
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const paidCtaLabel = (plan: PaidPlan): string => {
    if (checkoutLoadingPlan === plan) {
      return t("pricingPage.cta.redirecting", { defaultValue: "Redirecting…" });
    }
    if (!isLoggedIn) {
      return t("pricingPage.cta.signIn", { defaultValue: "Sign in to subscribe" });
    }
    return plan === "pro"
      ? t("pricingPage.cta.getPro", { defaultValue: "Get Pro" })
      : t("pricingPage.cta.getProPlus", { defaultValue: "Get Pro+" });
  };

  return (
    <div className="min-h-screen bg-bgSecondary glass-muted">
      <SEOHead
        title={t("pricingPage.seo.title", { defaultValue: "Pricing — StockAI Pro" })}
        description={t("pricingPage.seo.description", {
          defaultValue: "Free, Pro $9/mo, Pro+ $19/mo. AI investment research for retail investors.",
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
                "Pick the plan that fits your stage. Upgrade, downgrade, or cancel anytime — no long-term lock-in.",
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
          {!isLoggedIn ? (
            <p className="text-center glass-muted text-sm">
              {t("pricingPage.signInHint", {
                defaultValue: "Already have an account?",
              })}{" "}
              <Link to="/login" className="font-semibold text-brandCyan hover:underline">
                {t("pricingPage.signInLink", { defaultValue: "Sign in" })}
              </Link>{" "}
              {t("pricingPage.signInHintSuffix", { defaultValue: "to subscribe with one click." })}
            </p>
          ) : null}
          {checkoutError ? <p className="text-center text-sm text-negative">{checkoutError}</p> : null}
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <article
            className="rounded-2xl border p-6 shadow-sm"
            style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}
          >
            <h2 className="text-xl font-bold text-white">Free</h2>
            <p className="mt-3 glass-page-title text-3xl">{formatUsdPrice("free", billingCycle)}</p>
            <p className="mt-1 text-xs text-white/50">
              {t("pricingPage.plans.billedMonthly", { defaultValue: "Always free" })}
            </p>
            <p className="mt-3 glass-muted text-sm">
              {t("pricingPage.plans.free.tagline", {
                defaultValue: "Start with paper trading and core tools — no credit card.",
              })}
            </p>
            <PlanFeatureList planKey="free" textClassName="glass-muted" />
            <Link
              to="/register"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-brandDark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brandMedium"
            >
              {t("pricingPage.plans.free.cta", { defaultValue: "Start free" })}
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
            <p className="mt-3 text-3xl font-bold text-white">{formatUsdPrice("pro", billingCycle)}</p>
            <p className="mt-1 text-xs text-white/80">
              {billingCycle === "yearly"
                ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in USD" })
                : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in USD" })}
            </p>
            <p className="mt-3 text-sm text-white/90">
              {t("pricingPage.plans.pro.tagline", {
                defaultValue: "Best balance of price and power for active investors.",
              })}
            </p>
            <PlanFeatureList planKey="pro" textClassName="text-white/90" />
            <button
              type="button"
              onClick={() => void handleCheckout("pro")}
              disabled={checkoutLoadingPlan !== null}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paidCtaLabel("pro")}
            </button>
          </article>

          <article
            className="rounded-2xl border p-6 shadow-lg"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
              borderColor: colors.brandMedium,
            }}
          >
            <h2 className="text-xl font-bold text-white">Pro+</h2>
            <p className="mt-3 text-3xl font-bold text-white">{formatUsdPrice("proPlus", billingCycle)}</p>
            <p className="mt-1 text-xs text-white/80">
              {billingCycle === "yearly"
                ? t("pricingPage.plans.billedYearly", { defaultValue: "Billed annually in USD" })
                : t("pricingPage.plans.billedMonthly", { defaultValue: "Billed monthly in USD" })}
            </p>
            <p className="mt-3 text-sm text-white/90">
              {t("pricingPage.plans.proPlus.tagline", {
                defaultValue: "Full analytics stack, API access, and priority support.",
              })}
            </p>
            <PlanFeatureList planKey="proPlus" textClassName="text-white/90" />
            <button
              type="button"
              onClick={() => void handleCheckout("pro_plus")}
              disabled={checkoutLoadingPlan !== null}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paidCtaLabel("pro_plus")}
            </button>
          </article>
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
                      {isOpen ? "−" : "+"}
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
