import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const problemCards = [
  { icon: "🧩", titleKey: "landing.problem.cards.apps.title", bodyKey: "landing.problem.cards.apps.body" },
  { icon: "📉", titleKey: "landing.problem.cards.emotions.title", bodyKey: "landing.problem.cards.emotions.body" },
  { icon: "🧠", titleKey: "landing.problem.cards.memory.title", bodyKey: "landing.problem.cards.memory.body" },
];

const solutionFeatures = [
  "landing.solution.features.signalAnalysis",
  "landing.solution.features.behavioralCoach",
  "landing.solution.features.traderPsycheProfile",
  "landing.solution.features.globalMarkets",
  "landing.solution.features.brokerIntegration",
  "landing.solution.features.languages",
];

const pricingTiers = [
  {
    nameKey: "landing.pricing.tiers.free.name",
    priceKey: "landing.pricing.tiers.free.price",
    bodyKey: "landing.pricing.tiers.free.body",
    featuresKey: "landing.pricing.tiers.free.features",
    ctaKey: "landing.pricing.tiers.free.cta",
    highlighted: false,
  },
  {
    nameKey: "landing.pricing.tiers.pro.name",
    priceKey: "landing.pricing.tiers.pro.price",
    bodyKey: "landing.pricing.tiers.pro.body",
    featuresKey: "landing.pricing.tiers.pro.features",
    ctaKey: "landing.pricing.tiers.pro.cta",
    highlighted: true,
  },
  {
    nameKey: "landing.pricing.tiers.proPlus.name",
    priceKey: "landing.pricing.tiers.proPlus.price",
    bodyKey: "landing.pricing.tiers.proPlus.body",
    featuresKey: "landing.pricing.tiers.proPlus.features",
    ctaKey: "landing.pricing.tiers.proPlus.cta",
    highlighted: false,
  },
];

const testimonials = [
  { quoteKey: "landing.socialProof.testimonials.0.quote", authorKey: "landing.socialProof.testimonials.0.author" },
  { quoteKey: "landing.socialProof.testimonials.1.quote", authorKey: "landing.socialProof.testimonials.1.author" },
  { quoteKey: "landing.socialProof.testimonials.2.quote", authorKey: "landing.socialProof.testimonials.2.author" },
];

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden">
      <section className="relative isolate border-b border-brand-border/70">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_20%,rgba(0,242,255,0.18),transparent_35%),radial-gradient(circle_at_82%_18%,rgba(138,43,226,0.2),transparent_40%),linear-gradient(180deg,rgba(12,16,24,0.95),rgba(11,14,17,0.95))]" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <div className="absolute inset-x-0 top-14 mx-auto h-40 max-w-6xl animate-pulse rounded-full bg-brand-blue/10 blur-3xl" />
          <div className="absolute inset-x-0 top-32 mx-auto h-44 max-w-5xl animate-pulse rounded-full bg-brand-violet/10 blur-3xl [animation-delay:350ms]" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <span className="pill-signal inline-flex rounded-full border border-brand-border/80 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              StockAI Pro
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight text-white md:text-6xl">
              {t("landing.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-base text-slate-300 md:text-lg">{t("landing.hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="interactive-tilt rounded-xl bg-brand-amber px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(240,185,11,0.35)]"
              >
                {t("landing.hero.ctaPrimary")}
              </Link>
              <a
                href="#how-it-works"
                className="interactive-tilt rounded-xl border border-brand-border/80 bg-transparent px-6 py-3 text-sm font-semibold text-slate-100"
              >
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>
          </div>

          <div aria-hidden className="neo-panel relative rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
              <span>{t("landing.hero.widgetTitle")}</span>
              <span className="inline-flex items-center gap-2">
                <span className="live-dot" />
                {t("landing.hero.widgetLive")}
              </span>
            </div>
            <div className="grid h-56 grid-cols-12 gap-1.5 rounded-xl border border-brand-border/70 bg-slate-950/55 p-3">
              {Array.from({ length: 48 }).map((_, idx) => (
                <span
                  key={idx}
                  className="rounded bg-gradient-to-t from-brand-blue/25 via-brand-violet/35 to-brand-green/40"
                  style={{
                    height: `${28 + ((idx * 19) % 68)}%`,
                    alignSelf: "end",
                    animation: `pulse ${1.2 + (idx % 6) * 0.2}s ease-in-out ${(idx % 5) * 0.08}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">{t("landing.problem.title")}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {problemCards.map((card) => (
            <article key={card.titleKey} className="neo-panel interactive-tilt rounded-2xl p-6">
              <div className="mb-4 text-3xl" aria-hidden>
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-white">{t(card.titleKey)}</h3>
              <p className="mt-2 text-sm text-slate-300">{t(card.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-brand-border/60 bg-slate-950/35">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">{t("landing.solution.title")}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solutionFeatures.map((featureKey) => (
              <div key={featureKey} className="neo-panel rounded-2xl p-5">
                <p className="text-base font-semibold text-slate-100">{t(featureKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">{t("landing.socialProof.title")}</h2>
        <p className="mt-3 text-sm text-slate-300 md:text-base">{t("landing.socialProof.subtitle")}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.quoteKey} className="neo-panel rounded-2xl p-6">
              <p className="text-sm leading-relaxed text-slate-200">"{t(testimonial.quoteKey)}"</p>
              <footer className="mt-4 text-xs text-slate-400">
                {t(testimonial.authorKey)} - {t("landing.socialProof.betaTester")}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="border-y border-brand-border/60 bg-slate-950/35">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">{t("landing.pricing.title")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <article
                key={tier.nameKey}
                className={`rounded-2xl p-6 ${
                  tier.highlighted ? "neo-panel-accent neo-panel border border-brand-blue/40" : "neo-panel"
                }`}
              >
                <h3 className="text-xl font-semibold text-white">{t(tier.nameKey)}</h3>
                <p className="mt-2 text-3xl font-bold text-brand-amber">{t(tier.priceKey)}</p>
                <p className="mt-3 text-sm text-slate-300">{t(tier.bodyKey)}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-200">
                  {(t(tier.featuresKey, { returnObjects: true }) as string[]).map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand-green">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className="interactive-tilt mt-6 inline-flex rounded-lg border border-brand-border/70 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                >
                  {t(tier.ctaKey)}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="neo-panel rounded-2xl border border-brand-border/70 px-6 py-10 text-center md:px-10">
          <h2 className="text-3xl font-semibold text-white">{t("landing.footerCta.title")}</h2>
          <Link
            to="/dashboard"
            className="interactive-tilt mt-6 inline-flex rounded-xl bg-brand-amber px-7 py-3 text-sm font-semibold text-slate-950"
          >
            {t("landing.footerCta.button")}
          </Link>
          <p className="mt-4 text-xs text-slate-400">{t("landing.footerCta.disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}
