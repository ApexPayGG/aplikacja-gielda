import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
import { saveOnboardingPreferences, type InvestmentStyle } from "../utils/onboarding";

type WizardStep = 1 | 2 | 3 | 4;

const MARKET_OPTIONS = ["GPW", "NYSE/NASDAQ", "DAX", "LSE", "Azja", "Inne"];

const STYLE_OPTIONS: Array<{ id: InvestmentStyle; icon: string; title: string; description: string }> = [
  {
    id: "swing",
    icon: "📈",
    title: "Swing trader (dni-tygodnie)",
    description: "Pozycje trzymane od kilku dni do kilku tygodni.",
  },
  {
    id: "longterm",
    icon: "💼",
    title: "Długoterminowy (miesiące-lata)",
    description: "Inwestowanie na horyzont miesięcy lub lat.",
  },
  { id: "daytrader", icon: "⚡", title: "Daytrader (intraday)", description: "Decyzje i transakcje realizowane intraday." },
  { id: "learning", icon: "🔰", title: "Uczę się dopiero", description: "Buduję fundamenty i poznaję rynek krok po kroku." },
];

const RECOMMENDED_FEATURES = [
  {
    title: "Signals",
    description: "Przejrzyj bieżące sygnały inwestycyjne i ustaw własne alerty.",
    href: "/signals",
  },
  {
    title: "Behavioral Coach",
    description: "Analizuj decyzje i eliminuj powtarzające się błędy behawioralne.",
    href: "/behavioral-coach",
  },
  {
    title: "Paper Trading",
    description: "Testuj strategie bez ryzyka na wirtualnym kapitale.",
    href: "/paper-trading",
  },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<InvestmentStyle | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [styleError, setStyleError] = useState<string | null>(null);

  const progressPercent = useMemo(() => (step / 4) * 100, [step]);
  const firstName = user?.name?.trim() || "Inwestorze";

  function handleToggleMarket(market: string): void {
    setMarketError(null);
    setSelectedMarkets((previous) =>
      previous.includes(market) ? previous.filter((item) => item !== market) : [...previous, market],
    );
  }

  function goBack(): void {
    setStep((previous) => (previous > 1 ? ((previous - 1) as WizardStep) : previous));
  }

  function goNext(): void {
    if (step === 2 && selectedMarkets.length === 0) {
      setMarketError("Wybierz co najmniej jeden rynek, aby przejść dalej.");
      return;
    }

    if (step === 3 && !selectedStyle) {
      setStyleError("Wybierz styl inwestowania, aby kontynuować.");
      return;
    }

    if (step === 4) {
      if (!selectedStyle) {
        return;
      }
      saveOnboardingPreferences({
        markets: selectedMarkets,
        style: selectedStyle,
        completedAt: new Date().toISOString(),
      });
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
            Pomiń
          </Link>
        </div>

        <div className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_24px_72px_rgba(45,10,107,0.16)] sm:p-8">
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-textMuted">
              <span>Krok {step}/4</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bgTertiary">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, backgroundColor: colors.brandCyan }}
              />
            </div>
          </div>

          {step === 1 ? (
            <section className="space-y-5 text-center">
              <img src="/logo.png" alt="StockAI Pro" className="mx-auto h-20 w-auto object-contain" />
              <h1 className="text-3xl font-bold text-textPrimary">Witaj w StockAI Pro, {firstName}!</h1>
              <p className="mx-auto max-w-2xl text-base text-textSecondary">
                StockAI Pro to platforma, która łączy analitykę rynku, sygnały i wsparcie AI dla inwestora.
                Personalizujemy doświadczenie, aby szybciej prowadzić Cię do trafniejszych decyzji.
              </p>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-textPrimary">Którymi rynkami jesteś zainteresowany?</h2>
              <div className="flex flex-wrap gap-3">
                {MARKET_OPTIONS.map((market) => {
                  const selected = selectedMarkets.includes(market);
                  return (
                    <button
                      key={market}
                      type="button"
                      onClick={() => handleToggleMarket(market)}
                      className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                      style={{
                        borderColor: selected ? colors.brandCyan : colors.borderStrong,
                        backgroundColor: selected ? "rgba(0, 201, 212, 0.12)" : colors.bgPrimary,
                        color: colors.textPrimary,
                      }}
                    >
                      {market}
                    </button>
                  );
                })}
              </div>
              {marketError ? <p className="text-sm text-negative">{marketError}</p> : null}
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-textPrimary">Jaki masz styl inwestowania?</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {STYLE_OPTIONS.map((option) => {
                  const selected = selectedStyle === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedStyle(option.id);
                        setStyleError(null);
                      }}
                      className="rounded-2xl border p-4 text-left transition hover:shadow-sm"
                      style={{
                        borderColor: selected ? colors.brandCyan : colors.border,
                        backgroundColor: colors.bgPrimary,
                      }}
                    >
                      <p className="text-2xl">{option.icon}</p>
                      <p className="mt-2 text-base font-semibold text-textPrimary">{option.title}</p>
                      <p className="mt-1 text-sm text-textSecondary">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              {styleError ? <p className="text-sm text-negative">{styleError}</p> : null}
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-textPrimary">Twój profil jest gotowy</h2>
              <p className="text-sm text-textSecondary">
                Oto trzy funkcje, które najlepiej pomogą Ci wystartować już teraz:
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {RECOMMENDED_FEATURES.map((feature) => (
                  <Link
                    key={feature.href}
                    to={feature.href}
                    className="rounded-2xl border border-border bg-bgPrimary p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <p className="text-base font-semibold text-textPrimary">{feature.title}</p>
                    <p className="mt-1 text-sm text-textSecondary">{feature.description}</p>
                    <p className="mt-4 text-sm font-semibold text-brandCyan">Sprawdź →</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-textSecondary transition hover:bg-bgSecondary disabled:cursor-not-allowed disabled:opacity-0"
              disabled={step === 1}
            >
              ← Wstecz
            </button>

            <button
              type="button"
              onClick={goNext}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ backgroundColor: colors.brandDark }}
            >
              {step === 1 ? "Zaczynamy →" : null}
              {step === 2 ? "Dalej →" : null}
              {step === 3 ? "Dalej →" : null}
              {step === 4 ? "Przejdź do Dashboard →" : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
