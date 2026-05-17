import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { SEOHead } from "../components/SEOHead";
import { createStripeCheckoutSession, getLatestLiveQuote } from "../services/api";
import LanguageSwitcher from "../components/LanguageSwitcher";

const problemCards = [
  { icon: "🧩", titleKey: "landing.problem.cards.apps.title", bodyKey: "landing.problem.cards.apps.body" },
  { icon: "📉", titleKey: "landing.problem.cards.emotions.title", bodyKey: "landing.problem.cards.emotions.body" },
  { icon: "🧠", titleKey: "landing.problem.cards.context.title", bodyKey: "landing.problem.cards.context.body" },
];

const solutionFeatures = [
  { titleKey: "landing.solution.features.aiBrief.title", bodyKey: "landing.solution.features.aiBrief.body" },
  { titleKey: "landing.solution.features.behavioralCoach.title", bodyKey: "landing.solution.features.behavioralCoach.body" },
  { titleKey: "landing.solution.features.signalDna.title", bodyKey: "landing.solution.features.signalDna.body" },
  { titleKey: "landing.solution.features.preMortemAi.title", bodyKey: "landing.solution.features.preMortemAi.body" },
  { titleKey: "landing.solution.features.globalMarkets.title", bodyKey: "landing.solution.features.globalMarkets.body" },
  { titleKey: "landing.solution.features.paperTrading.title", bodyKey: "landing.solution.features.paperTrading.body" },
];

const socialProofStats = [
  "landing.socialProof.stats.exchanges",
  "landing.socialProof.stats.modules",
  "landing.socialProof.stats.languages",
  "landing.socialProof.stats.adFree",
];

const pricingTiers = [
  {
    id: "free",
    nameKey: "landing.pricing.tiers.free.name",
    bodyKey: "landing.pricing.tiers.free.body",
    featuresKey: "landing.pricing.tiers.free.features",
    ctaKey: "landing.pricing.tiers.free.cta",
    highlighted: false,
  },
  {
    id: "pro",
    nameKey: "landing.pricing.tiers.pro.name",
    bodyKey: "landing.pricing.tiers.pro.body",
    featuresKey: "landing.pricing.tiers.pro.features",
    ctaKey: "landing.pricing.tiers.pro.cta",
    highlighted: true,
  },
  {
    id: "proPlus",
    nameKey: "landing.pricing.tiers.proPlus.name",
    bodyKey: "landing.pricing.tiers.proPlus.body",
    featuresKey: "landing.pricing.tiers.proPlus.features",
    ctaKey: "landing.pricing.tiers.proPlus.cta",
    highlighted: false,
  },
];

const HERO_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "XOM", "V"] as const;

type HeroQuote = {
  ticker: string;
  price: number | null;
  changePct: number | null;
};

const HERO_QUOTES_CACHE_KEY = "landing.heroQuotes.v1";
type BillingCycle = "monthly" | "yearly";

function toNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidHeroQuoteArray(value: unknown): value is HeroQuote[] {
  if (!Array.isArray(value)) return false;
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as Partial<HeroQuote>;
    const isTickerValid = typeof candidate.ticker === "string" && candidate.ticker.length > 0;
    const isPriceValid = candidate.price == null || typeof candidate.price === "number";
    const isChangeValid = candidate.changePct == null || typeof candidate.changePct === "number";
    return isTickerValid && isPriceValid && isChangeValid;
  });
}

function readCachedHeroQuotes(): HeroQuote[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HERO_QUOTES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidHeroQuoteArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedHeroQuotes(rows: HeroQuote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HERO_QUOTES_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // Ignore storage write errors (private mode/full storage).
  }
}

export function LandingPage() {
  const { t } = useTranslation("common");
  const [quotes, setQuotes] = useState<HeroQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<"pro" | "pro_plus" | null>(null);

  const emptyQuotes = useMemo<HeroQuote[]>(
    () =>
      HERO_TICKERS.map((ticker) => ({
        ticker,
        price: null,
        changePct: null,
      })),
    [],
  );

  const pricingFeatures = (featuresKey: string): string[] => {
    const translated = t(featuresKey, { returnObjects: true });
    if (Array.isArray(translated)) {
      return translated.filter((item): item is string => typeof item === "string");
    }
    return [];
  };

  useEffect(() => {
    let active = true;
    const cached = readCachedHeroQuotes();
    if (cached && cached.length > 0) {
      setQuotes(cached);
      setQuotesLoading(false);
    }

    async function loadQuotes(): Promise<void> {
      setQuotesLoading(true);
      const rows = await Promise.all(
        HERO_TICKERS.map(async (ticker): Promise<HeroQuote> => {
          try {
            const { quote } = await getLatestLiveQuote(ticker);
            const open = toNumber(quote.open);
            const close = toNumber(quote.price);
            const changePct =
              close !== null && open !== null && open > 0 ? ((close - open) / open) * 100 : null;
            return { ticker, price: close, changePct };
          } catch {
            return { ticker, price: null, changePct: null };
          }
        }),
      );
      if (!active) return;
      setQuotes(rows);
      if (rows.some((row) => row.price !== null || row.changePct !== null)) {
        writeCachedHeroQuotes(rows);
      }
      setQuotesLoading(false);
    }
    void loadQuotes();
    return () => {
      active = false;
    };
  }, []);

  const displayedQuotes = quotes.length > 0 ? quotes : emptyQuotes;

  const handleChoosePlan = async (plan: "pro" | "pro_plus"): Promise<void> => {
    const userId =
      typeof window !== "undefined" ? window.localStorage.getItem("userId")?.trim() ?? "" : "";
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    try {
      setCheckoutLoadingPlan(plan);
      const { url } = await createStripeCheckoutSession({
        userId,
        plan,
        billing: billingCycle,
      });
      window.location.href = url;
    } catch (error) {
      console.error("Failed to create Stripe Checkout session", error);
      window.alert(t("landing.pricing.checkoutError", { defaultValue: "Nie udało się rozpocząć płatności." }));
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  return (
    <div className="bg-bgPrimary text-textSecondary">
      <SEOHead
        title="StockAI Pro — AI Investment Research Platform"
        description="AI-powered stock analysis, behavioral coaching and broker integration. GPW, NYSE, DAX and 130+ markets."
        ogType="website"
      />
      <header className="sticky top-0 z-40 border-b border-border bg-bgPrimary/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex shrink-0 items-center">
            <Link to="/">
              <img src="/logo.png" alt="StockAI Pro" className="h-8 w-40 object-cover object-center" />
            </Link>
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-textSecondary md:flex">
            <a href="#problem" className="transition hover:text-brandDark">
              Problem
            </a>
            <a href="#solution" className="transition hover:text-brandDark">
              Solution
            </a>
            <a href="#pricing" className="transition hover:text-brandDark">
              Pricing
            </a>
            <Link to="/companies" className="transition hover:text-brandDark">
              Markets
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/register"
              className="rounded-xl bg-brandDark px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brandMedium"
            >
              {t("auth.registerButton", { defaultValue: "Register" })}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brandDark/10 via-bgPrimary to-brandMedium/10" />
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-border bg-bgPrimary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brandDark">
              AMC Energy Edition
            </span>
            <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-tight text-textPrimary md:text-6xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-normal text-textSecondary">{t("landing.hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="rounded-xl bg-brandDark px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brandMedium"
              >
                {t("landing.hero.ctaPrimary")}
              </Link>
              <a
                href="#solution"
                className="rounded-xl border border-brandCyan px-7 py-3 text-sm font-semibold text-brandDark transition hover:bg-brandCyan/10"
              >
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>
          </div>

          <aside className="relative z-10 rounded-2xl border border-border bg-bgPrimary p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between text-xs text-textMuted">
              <span>{t("landing.hero.widgetTitle", { defaultValue: "Live market pulse" })}</span>
              <span className="inline-flex items-center gap-2 font-semibold text-brandDark">
                <span className="h-2 w-2 rounded-full bg-positive" />
                {t("landing.hero.widgetLive")}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {displayedQuotes.map((row) => (
                <div key={row.ticker} className="rounded-xl border border-border bg-bgPrimary px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-textSecondary">{row.ticker}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.changePct == null
                          ? "bg-bgTertiary text-textMuted"
                          : row.changePct >= 0
                            ? "bg-positive/10 text-positive"
                            : "bg-negative/10 text-negative"
                      }`}
                    >
                      {row.changePct == null ? "—" : `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-brandDark">
                    {row.price == null ? "—" : row.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            {quotesLoading ? <p className="mt-3 text-xs text-textMuted">{t("common.loading")}</p> : null}
          </aside>
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <h2 className="text-3xl font-bold text-textPrimary">{t("landing.problem.title")}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {problemCards.map((card) => (
            <article key={card.titleKey} className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-sm">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brandCyan/10 text-xl text-brandCyan">
                {card.icon}
              </div>
              <h3 className="text-lg font-bold text-textPrimary">{t(card.titleKey)}</h3>
              <p className="mt-2 text-sm text-textSecondary">{t(card.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="solution" className="bg-bgSecondary py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold text-textPrimary">{t("landing.solution.title")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {solutionFeatures.map((feature) => (
              <div key={feature.titleKey} className="rounded-xl border border-border bg-bgPrimary p-5 shadow-sm">
                <p className="border-l-4 border-brandCyan pl-3 text-base font-semibold text-textPrimary">
                  {t(feature.titleKey)}
                </p>
                <p className="mt-3 text-sm text-textSecondary">{t(feature.bodyKey)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-bgPrimary p-6 shadow-sm">
            <p className="text-sm font-semibold text-textPrimary">{t("etoro.subtitle")}</p>
            <EtoroCTAButton sourcePage="landing_page" className="mt-3 max-w-sm" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <h2 className="text-center text-3xl font-bold text-textPrimary">{t("landing.socialProof.title")}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {socialProofStats.map((statKey) => (
            <article key={statKey} className="rounded-2xl border border-border bg-bgPrimary p-6 text-center shadow-sm">
              <p className="text-lg font-bold text-brandDark">{t(statKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <h2 className="text-3xl font-bold text-textPrimary">{t("landing.pricing.title")}</h2>
        <div className="mt-6 inline-flex rounded-xl border border-border bg-bgSecondary p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              billingCycle === "monthly" ? "bg-brandDark text-white" : "text-textSecondary hover:text-brandDark"
            }`}
          >
            {t("landing.pricing.monthly", { defaultValue: "monthly" })}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              billingCycle === "yearly" ? "bg-brandDark text-white" : "text-textSecondary hover:text-brandDark"
            }`}
          >
            {t("landing.pricing.yearly", { defaultValue: "yearly" })}
          </button>
        </div>
        <p className="mt-3 text-sm text-brandMedium">
          {t("landing.pricing.earlyAdopter", {
            defaultValue: "First 500 Pro accounts locked at $9/mo forever",
          })}
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {pricingTiers.map((tier) => {
            const highlighted = tier.highlighted;
            return (
              <article
                key={tier.nameKey}
                className={`rounded-2xl border p-6 shadow-lg ${
                  highlighted ? "border-brandDark bg-brandDark text-white" : "border-border bg-bgPrimary text-textSecondary"
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className={`text-xl font-bold ${highlighted ? "text-white" : "text-textPrimary"}`}>{t(tier.nameKey)}</h3>
                  {tier.id === "pro" ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        highlighted ? "bg-white/15 text-white" : "bg-brandDark/10 text-brandDark"
                      }`}
                    >
                      {t("landing.pricing.popular", { defaultValue: "Most Popular" })}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-3 font-mono text-3xl font-bold ${highlighted ? "text-white" : "text-brandDark"}`}>
                  {tier.id === "free"
                    ? "$0/mo"
                    : tier.id === "pro"
                      ? billingCycle === "monthly"
                        ? "$9/mo"
                        : "$79/yr"
                      : billingCycle === "monthly"
                        ? "$19/mo"
                        : "$149/yr"}
                </p>
                {tier.id === "pro" && billingCycle === "yearly" ? (
                  <p className={`mt-1 text-xs font-semibold ${highlighted ? "text-brandCyan" : "text-positive"}`}>
                    {t("landing.pricing.save", { defaultValue: "Save 27%" })}
                  </p>
                ) : null}
                {tier.id === "proPlus" && billingCycle === "yearly" ? (
                  <p className={`mt-1 text-xs font-semibold ${highlighted ? "text-brandCyan" : "text-positive"}`}>
                    {t("landing.pricing.saveProPlus", { defaultValue: "Save 34%" })}
                  </p>
                ) : null}
                <p className={`mt-3 text-sm ${highlighted ? "text-white/85" : "text-textSecondary"}`}>{t(tier.bodyKey)}</p>
                <ul className={`mt-5 space-y-2 text-sm ${highlighted ? "text-white/90" : "text-textSecondary"}`}>
                  {pricingFeatures(tier.featuresKey).map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className={highlighted ? "text-brandCyan" : "text-positive"}>✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {tier.id === "pro" || tier.id === "proPlus" ? (
                  <button
                    type="button"
                    onClick={() => void handleChoosePlan(tier.id === "pro" ? "pro" : "pro_plus")}
                    disabled={checkoutLoadingPlan !== null}
                    className={`mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      highlighted
                        ? "bg-white text-brandDark hover:bg-bgSecondary"
                        : "bg-brandDark text-white hover:bg-brandMedium"
                    }`}
                  >
                    {checkoutLoadingPlan === (tier.id === "pro" ? "pro" : "pro_plus")
                      ? t("common.loading", { defaultValue: "Loading..." })
                      : t(tier.ctaKey)}
                  </button>
                ) : (
                  <Link
                    to="/dashboard"
                    className={`mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      highlighted ? "bg-white text-brandDark hover:bg-bgSecondary" : "bg-brandDark text-white hover:bg-brandMedium"
                    }`}
                  >
                    {t(tier.ctaKey)}
                  </Link>
                )}
                {tier.id === "pro" ? (
                  <p className={`mt-2 text-xs ${highlighted ? "text-white/75" : "text-textMuted"}`}>
                    {t("landing.pricing.trial", { defaultValue: "14 days free" })}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-gradient-to-r from-brandDark to-brandMedium py-14">
        <div className="mx-auto max-w-5xl px-6 text-center text-white">
          <h2 className="text-3xl font-bold">{t("landing.footerCta.title")}</h2>
          <p className="mt-3 text-sm text-white/85">{t("landing.footerCta.disclaimer")}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex rounded-xl bg-white px-7 py-3 text-sm font-semibold text-brandDark transition hover:bg-bgSecondary"
            >
              {t("landing.footerCta.button")}
            </Link>
            <Link
              to="/waitlist?source=landing"
              className="inline-flex rounded-xl border border-white/60 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Dołącz do waitlisty
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-bgPrimary">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 px-6 py-5 text-sm text-textMuted">
          <Link to="/privacy" className="transition hover:text-brandDark">
            Privacy
          </Link>
          <span aria-hidden="true">|</span>
          <Link to="/terms" className="transition hover:text-brandDark">
            Terms
          </Link>
          <span aria-hidden="true">|</span>
          <Link to="/pricing" className="transition hover:text-brandDark">
            Pricing
          </Link>
          <span aria-hidden="true">|</span>
          <Link to="/changelog" className="transition hover:text-brandDark">
            Changelog
          </Link>
        </div>
      </footer>
    </div>
  );
}
