import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { colors } from "../styles/designSystem";
import { saveOnboardingPreferences, type InvestmentStyle } from "../utils/onboarding";

type WizardStep = 1 | 2 | 3 | 4;

const MARKET_IDS = ["gpw", "nyse_nasdaq", "dax", "lse", "asia", "other"] as const;
type MarketId = (typeof MARKET_IDS)[number];

const STYLE_IDS: InvestmentStyle[] = ["swing", "longterm", "daytrader", "learning"];

const FEATURE_IDS = ["signals", "behavioralCoach", "paperTrading"] as const;
type FeatureId = (typeof FEATURE_IDS)[number];

const FEATURE_HREFS: Record<FeatureId, string> = {
  signals: "/signals",
  behavioralCoach: "/behavioral-coach",
  paperTrading: "/paper-trading",
};

export function OnboardingPage() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedMarkets, setSelectedMarkets] = useState<MarketId[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<InvestmentStyle | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);

  const progressPercent = useMemo(() => (step / 4) * 100, [step]);
  const firstName = user?.name?.trim() || t("onboarding.defaultName", { defaultValue: "Investor" });

  function handleToggleMarket(market: MarketId): void {
    setMarketError(null);
    setSelectedMarkets((previous) =>
      previous.includes(market) ? previous.filter((item) => item !== market) : [...previous, market],
    );
  }

  function goBack(): void {
    setStep((previous) => (previous > 1 ? ((previous - 1) as WizardStep) : previous));
  }

  function persistOnboardingCompletion(): void {
    if (!selectedStyle) {
      return;
    }
    saveOnboardingPreferences({
      markets: selectedMarkets,
      style: selectedStyle,
      completedAt: new Date().toISOString(),
    });
  }

  function handleFeatureNavigate(href: string): void {
    saveOnboardingPreferences({
      markets: selectedMarkets,
      style: selectedStyle ?? "learning",
      completedAt: new Date().toISOString(),
    });
    navigate(href, { replace: true });
  }

  function goNext(): void {
    if (step === 2 && selectedMarkets.length === 0) {
      setMarketError(t("onboarding.markets.error", { defaultValue: "Select at least one market to continue." }));
      return;
    }

    if (step === 3 && !selectedStyle) {
      setStyleError(t("onboarding.style.error", { defaultValue: "Select an investment style to continue." }));
      return;
    }

    if (step === 4) {
      if (!selectedStyle) {
        return;
      }
      persistOnboardingCompletion();
      navigate("/dashboard", { replace: true });
      return;
    }

    setStyleError(null);
    setStep((previous) => (previous < 4 ? ((previous + 1) as WizardStep) : previous));
  }

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex justify-end">
          <Link to="/dashboard" className="text-sm font-medium text-brandCyan transition hover:brightness-90">
            {t("onboarding.skip", { defaultValue: "Skip" })}
          </Link>
        </div>

        <div className="glass-section rounded-3xl p-6 shadow-[0_24px_72px_rgba(45,10,107,0.16)] sm:p-8">
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-white/50">
              <span>{t("onboarding.step", { current: step, total: 4, defaultValue: "Step {{current}}/{{total}}" })}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, backgroundColor: colors.brandCyan }}
              />
            </div>
          </div>

          {step === 1 ? (
            <section className="space-y-5 text-center">
              <BrandLogo size="cardLg" className="mx-auto" />
              <h1 className="text-3xl font-bold text-white">
                {t("onboarding.welcome.title", {
                  name: firstName,
                  defaultValue: "Welcome to StockAI Pro, {{name}}!",
                })}
              </h1>
              <p className="mx-auto max-w-2xl text-base glass-muted">
                {t("onboarding.welcome.body", {
                  defaultValue:
                    "StockAI Pro combines market analytics, signals, and AI support for investors. We personalize your experience to help you make better decisions faster.",
                })}
              </p>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {t("onboarding.markets.title", { defaultValue: "Which markets are you interested in?" })}
              </h2>
              <div className="flex flex-wrap gap-3">
                {MARKET_IDS.map((marketId) => {
                  const selected = selectedMarkets.includes(marketId);
                  return (
                    <button
                      key={marketId}
                      type="button"
                      onClick={() => handleToggleMarket(marketId)}
                      className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                      style={{
                        borderColor: selected ? colors.brandCyan : colors.borderStrong,
                        backgroundColor: selected ? "rgba(0, 201, 212, 0.12)" : colors.bgPrimary,
                        color: colors.textPrimary,
                      }}
                    >
                      {t(`onboarding.markets.options.${marketId}`, { defaultValue: marketId })}
                    </button>
                  );
                })}
              </div>
              {marketError ? <p className="text-sm text-negative">{marketError}</p> : null}
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {t("onboarding.style.title", { defaultValue: "What is your investment style?" })}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {STYLE_IDS.map((styleId) => {
                  const selected = selectedStyle === styleId;
                  return (
                    <button
                      key={styleId}
                      type="button"
                      onClick={() => {
                        setSelectedStyle(styleId);
                        setStyleError(null);
                      }}
                      className="rounded-2xl border p-4 text-left transition hover:shadow-sm"
                      style={{
                        borderColor: selected ? colors.brandCyan : colors.border,
                        backgroundColor: colors.bgPrimary,
                      }}
                    >
                      <p className="text-2xl">{t(`onboarding.style.${styleId}.icon`, { defaultValue: "📈" })}</p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {t(`onboarding.style.${styleId}.title`, { defaultValue: styleId })}
                      </p>
                      <p className="mt-1 glass-muted text-sm">
                        {t(`onboarding.style.${styleId}.description`, { defaultValue: "" })}
                      </p>
                    </button>
                  );
                })}
              </div>
              {styleError ? <p className="text-sm text-negative">{styleError}</p> : null}
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {t("onboarding.ready.title", { defaultValue: "Your profile is ready" })}
              </h2>
              <p className="glass-muted text-sm">
                {t("onboarding.ready.subtitle", {
                  defaultValue: "Here are three features to help you get started right away:",
                })}
              </p>
              <div className="relative z-10 grid gap-4 md:grid-cols-3">
                {FEATURE_IDS.map((featureId) => (
                  <button
                    key={featureId}
                    type="button"
                    onClick={() => handleFeatureNavigate(FEATURE_HREFS[featureId])}
                    className="block w-full glass-section rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <p className="text-base font-semibold text-white">
                      {t(`onboarding.features.${featureId}.title`, { defaultValue: featureId })}
                    </p>
                    <p className="mt-1 glass-muted text-sm">
                      {t(`onboarding.features.${featureId}.description`, { defaultValue: "" })}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-brandCyan">
                      {t("onboarding.ready.explore", { defaultValue: "Explore →" })}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg px-3 py-2 text-sm font-semibold glass-muted transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-0"
              disabled={step === 1}
            >
              {t("onboarding.nav.back", { defaultValue: "← Back" })}
            </button>

            <button
              type="button"
              onClick={goNext}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ backgroundColor: colors.brandDark }}
            >
              {step === 1 ? t("onboarding.nav.start", { defaultValue: "Let's go →" }) : null}
              {step === 2 ? t("onboarding.nav.next", { defaultValue: "Next →" }) : null}
              {step === 3 ? t("onboarding.nav.next", { defaultValue: "Next →" }) : null}
              {step === 4 ? t("onboarding.nav.dashboard", { defaultValue: "Go to Dashboard →" }) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
