import {
  ArrowRightIcon,
  ChartBarSquareIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const POPULAR_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"] as const;

export function DashboardWelcomeHero() {
  const { t } = useTranslation();

  const steps = [
    t("dashboard.hero.step1", { defaultValue: "Pick companies you follow" }),
    t("dashboard.hero.step2", { defaultValue: "Read AI briefs and signals" }),
    t("dashboard.hero.step3", { defaultValue: "Track mindset with the coach" }),
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brandDark/15 bg-gradient-to-br from-[#2D0A6B]/[0.07] via-bgPrimary to-brandCyan/[0.06] p-6 shadow-sm md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brandCyan/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brandDark/10 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brandDark text-white shadow-md">
          <SparklesIcon className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brandDark">
            {t("dashboard.hero.eyebrow", { defaultValue: "Your StockAI hub" })}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-textPrimary md:text-3xl">
            {t("dashboard.hero.title", { defaultValue: "Build your market watchlist" })}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-textSecondary">
            {t("dashboard.hero.subtitle", {
              defaultValue:
                "Add a few tickers to unlock live quotes, movement alerts, and AI context tailored to what you actually trade.",
            })}
          </p>
        </div>
      </div>

      <ol className="relative mt-6 grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-3 rounded-xl border border-border/80 bg-bgPrimary/80 px-3 py-2.5 text-sm text-textSecondary backdrop-blur-sm"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brandDark text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link
          to="/companies"
          className="inline-flex items-center gap-2 rounded-xl bg-brandDark px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
          {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
          <ArrowRightIcon className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          to="/signals"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-bgPrimary px-4 py-2.5 text-sm font-semibold text-brandDark transition hover:border-brandDark/40"
        >
          <ChartBarSquareIcon className="h-4 w-4" aria-hidden />
          {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
        </Link>
      </div>

      <div className="relative mt-6 border-t border-border/70 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">
          {t("dashboard.hero.popularLabel", { defaultValue: "Popular to start" })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR_SYMBOLS.map((symbol) => (
            <Link
              key={symbol}
              to={`/company/${encodeURIComponent(symbol)}`}
              className="rounded-full border border-border bg-bgPrimary px-3.5 py-1.5 font-mono text-sm font-semibold text-brandDark transition hover:border-brandDark hover:bg-brandDark/5"
            >
              {symbol}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
