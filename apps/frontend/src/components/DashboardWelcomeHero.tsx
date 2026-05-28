import {
  ArrowRightIcon,
  ChartBarSquareIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  TERMINAL_BADGE,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_CARD,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_SECTION_TITLE,
} from "./terminal/terminalStyles";

const POPULAR_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"] as const;

export function DashboardWelcomeHero() {
  const { t } = useTranslation();

  const steps = [
    t("dashboard.hero.step1", { defaultValue: "Pick companies you follow" }),
    t("dashboard.hero.step2", { defaultValue: "Read AI briefs and signals" }),
    t("dashboard.hero.step3", { defaultValue: "Track mindset with the coach" }),
  ];

  return (
    <section className={`${TERMINAL_CARD} relative overflow-hidden border-terminal-cyan/20 p-6 md:p-8`}>
      <div className="relative flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-terminal-cyan text-terminal-buttonText shadow-terminal-glow">
          <SparklesIcon className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("dashboard.hero.eyebrow", { defaultValue: "Your StockAI hub" })}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-terminal-text md:text-3xl">
            {t("dashboard.hero.title", { defaultValue: "Build your market watchlist" })}
          </h2>
          <p className={`mt-2 max-w-xl ${TERMINAL_PAGE_SUBTITLE}`}>
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
            className="flex items-start gap-3 rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 py-2.5 text-sm text-terminal-textSecondary"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terminal-cyan text-xs font-bold text-terminal-buttonText">
              {index + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link to="/companies" className={`${TERMINAL_BUTTON_PRIMARY} gap-2`}>
          <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
          {t("dashboard.hero.ctaBrowse", { defaultValue: "Browse companies" })}
          <ArrowRightIcon className="h-4 w-4" aria-hidden />
        </Link>
        <Link to="/signals" className={`${TERMINAL_BUTTON_SECONDARY} gap-2`}>
          <ChartBarSquareIcon className="h-4 w-4" aria-hidden />
          {t("dashboard.hero.ctaSignals", { defaultValue: "View signals" })}
        </Link>
      </div>

      <div className="relative mt-6 border-t border-terminal-borderMuted pt-5">
        <p className={TERMINAL_SECTION_TITLE}>
          {t("dashboard.hero.popularLabel", { defaultValue: "Popular to start" })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR_SYMBOLS.map((symbol) => (
            <Link key={symbol} to={`/company/${encodeURIComponent(symbol)}`}>
              <span className={`${TERMINAL_BADGE} cursor-pointer font-mono normal-case transition hover:border-terminal-cyan/50`}>
                {symbol}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
