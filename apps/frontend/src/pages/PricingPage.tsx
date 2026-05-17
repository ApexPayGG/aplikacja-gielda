import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { createStripeCheckoutSession } from "../services/api";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";

type BillingCycle = "monthly" | "yearly";
type PaidPlan = "pro" | "pro_plus";

type FeatureMatrixRow = {
  feature: string;
  free: boolean;
  pro: boolean;
  proPlus: boolean;
};

const planFeatures: FeatureMatrixRow[] = [
  { feature: "Paper trading bez ryzyka", free: true, pro: true, proPlus: true },
  { feature: "Dziennik transakcyjny i statystyki", free: true, pro: true, proPlus: true },
  { feature: "Skaner sygnałów premium", free: false, pro: true, proPlus: true },
  { feature: "AI coach behawioralny", free: false, pro: true, proPlus: true },
  { feature: "Zaawansowane scenariusze stres testów", free: false, pro: false, proPlus: true },
  { feature: "Priorytetowe wsparcie", free: false, pro: false, proPlus: true },
];

const faqItems = [
  {
    question: "Czy mogę anulować subskrypcję?",
    answer: "Tak, subskrypcję możesz anulować w dowolnym momencie w panelu konta. Dostęp pozostaje aktywny do końca bieżącego okresu rozliczeniowego.",
  },
  {
    question: "Czy jest trial?",
    answer: "Dla planu Pro oferujemy 14-dniowy okres próbny. W tym czasie możesz przetestować pełną funkcjonalność planu.",
  },
  {
    question: "Jakie metody płatności?",
    answer: "Płatności obsługuje Stripe. Akceptujemy najpopularniejsze karty płatnicze oraz metody dostępne lokalnie przez Stripe.",
  },
  {
    question: "Czy dane są bezpieczne?",
    answer: "Stosujemy szyfrowanie transmisji, ograniczony dostęp do danych i regularne przeglądy bezpieczeństwa zgodne z dobrymi praktykami branżowymi.",
  },
  {
    question: "Co to jest paper trading?",
    answer: "Paper trading to symulacja inwestowania na danych rynkowych bez używania prawdziwych środków. Pozwala trenować strategię bez ryzyka finansowego.",
  },
];

function formatPrice(plan: "free" | "pro" | "proPlus", billingCycle: BillingCycle): string {
  if (plan === "free") return "0 zł / mies.";
  if (plan === "pro") return billingCycle === "monthly" ? "49 zł / mies." : "490 zł / rok";
  return billingCycle === "monthly" ? "99 zł / mies." : "990 zł / rok";
}

function PlanFeatureList({
  planKey,
  textClassName,
}: {
  planKey: "free" | "pro" | "proPlus";
  textClassName: string;
}) {
  return (
    <ul className={`mt-5 space-y-3 ${textClassName}`}>
      {planFeatures.map((row) => {
        const included = row[planKey];
        return (
          <li key={row.feature} className="flex items-start gap-3 text-sm">
            <span style={{ color: included ? colors.positive : colors.textMuted }} className="mt-0.5 font-semibold">
              {included ? "✓" : "✕"}
            </span>
            <span>{row.feature}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PaidPlan | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const pricingNote = useMemo(() => {
    return billingCycle === "yearly" ? "Płatność roczna = 2 miesiące gratis względem planu miesięcznego." : "Zmieniaj plan w dowolnym momencie.";
  }, [billingCycle]);

  const handleCheckout = async (plan: PaidPlan): Promise<void> => {
    const userId = typeof window !== "undefined" ? window.localStorage.getItem("userId")?.trim() ?? "" : "";
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    try {
      setCheckoutLoadingPlan(plan);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("checkout_plan", plan);
      }
      trackEvent("begin_checkout", { plan, billing: billingCycle });
      const { url } = await createStripeCheckoutSession({
        userId,
        plan,
        billing: billingCycle,
      });
      window.location.href = url;
    } catch (error) {
      console.error("Failed to start Stripe checkout", error);
      window.alert("Nie udało się rozpocząć checkoutu Stripe. Spróbuj ponownie za chwilę.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-bgSecondary text-textSecondary">
      <SEOHead
        title="Cennik — StockAI Pro"
        description="Free, Pro $9/mo, Pro+ $19/mo. AI investment research for retail investors."
      />
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-textPrimary md:text-5xl">Wybierz swój plan</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-textSecondary md:text-lg">
            Dopasuj subskrypcję do etapu Twojego rozwoju tradera. Zawsze możesz zmienić plan lub zrezygnować bez zobowiązań długoterminowych.
          </p>
        </header>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="inline-flex rounded-xl border p-1" style={{ borderColor: colors.brandCyan }}>
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className="rounded-lg px-5 py-2 text-sm font-semibold transition"
              style={{
                backgroundColor: billingCycle === "monthly" ? colors.brandCyan : "transparent",
                color: billingCycle === "monthly" ? colors.brandDark : colors.textSecondary,
              }}
            >
              Miesięcznie
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className="rounded-lg px-5 py-2 text-sm font-semibold transition"
              style={{
                backgroundColor: billingCycle === "yearly" ? colors.brandCyan : "transparent",
                color: billingCycle === "yearly" ? colors.brandDark : colors.textSecondary,
              }}
            >
              Rocznie
            </button>
          </div>
          <p className="text-sm text-textMuted">{pricingNote}</p>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}>
            <h2 className="text-xl font-bold text-textPrimary">Free</h2>
            <p className="mt-3 text-3xl font-bold text-brandDark">{formatPrice("free", billingCycle)}</p>
            <p className="mt-3 text-sm text-textSecondary">Dla osób, które zaczynają i chcą trenować na koncie demonstracyjnym.</p>
            <PlanFeatureList planKey="free" textClassName="text-textSecondary" />
            <Link
              to="/register"
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-brandDark px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brandMedium"
            >
              Zacznij za darmo
            </Link>
            <EtoroCTAButton sourcePage="pricing_page" className="mt-3" />
          </article>

          <article className="rounded-2xl border p-6 shadow-lg" style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Pro</h2>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                Najpopularniejszy
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{formatPrice("pro", billingCycle)}</p>
            <p className="mt-3 text-sm text-white/90">Najlepszy balans między ceną a możliwościami dla aktywnych traderów.</p>
            <PlanFeatureList planKey="pro" textClassName="text-white/90" />
            <button
              type="button"
              onClick={() => void handleCheckout("pro")}
              disabled={checkoutLoadingPlan !== null}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brandDark transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {checkoutLoadingPlan === "pro" ? "Przekierowywanie..." : "Przejdź do Stripe Checkout"}
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
            <p className="mt-3 text-3xl font-bold text-white">{formatPrice("proPlus", billingCycle)}</p>
            <p className="mt-3 text-sm text-white/90">Dla najbardziej wymagających: pełny pakiet analityczny i priorytetowe wsparcie.</p>
            <PlanFeatureList planKey="proPlus" textClassName="text-white/90" />
            <button
              type="button"
              onClick={() => void handleCheckout("pro_plus")}
              disabled={checkoutLoadingPlan !== null}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brandDark transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {checkoutLoadingPlan === "pro_plus" ? "Przekierowywanie..." : "Przejdź do Stripe Checkout"}
            </button>
          </article>
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-bgPrimary p-6 md:p-8">
          <h2 className="text-2xl font-bold text-textPrimary">FAQ</h2>
          <div className="mt-6 divide-y divide-border">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.question} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                    className="flex w-full items-center justify-between gap-4 py-2 text-left"
                  >
                    <span className="font-semibold text-textPrimary">{item.question}</span>
                    <span style={{ color: colors.brandCyan }} className="text-lg font-semibold">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen ? <p className="pr-8 text-sm text-textSecondary">{item.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
