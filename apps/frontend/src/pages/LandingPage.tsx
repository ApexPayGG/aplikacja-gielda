import { type SVGProps, useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createStripeCheckoutSession } from "../services/api";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { SEOHead } from "../components/SEOHead";

const BRAND = {
  dark: "#2D0A6B",
  medium: "#7A0F9E",
  cyan: "#00C9D4",
  gold: "#FFAE33",
} as const;

const ETORO_AFFILIATE_URL =
  "https://med.etoro.com/B9219_A129734_TClick_Sstockaipro-main.aspx";

type SolutionIconId = "brief" | "coach" | "dna" | "premortem" | "globe" | "paper";

const solutionCards: { iconId: SolutionIconId; title: string; body: string }[] = [
  {
    iconId: "brief",
    title: "AI Brief z narracją",
    body: "Nie sam score — pełne wyjaśnienie dlaczego warto lub nie. Claude Sonnet analizuje za Ciebie.",
  },
  {
    iconId: "coach",
    title: "Behavioral Coach",
    body: "Wykrywa wzorce Twoich błędów i interweniuje zanim popełnisz kolejny.",
  },
  {
    iconId: "dna",
    title: "Signal DNA",
    body: "Historyczne bliźniaki setupu. Jak ten układ kończył się w przeszłości — ze statystykami.",
  },
  {
    iconId: "premortem",
    title: "Pre-Mortem AI",
    body: "Zanim kupisz — AI pokazuje najbardziej prawdopodobny scenariusz straty.",
  },
  {
    iconId: "globe",
    title: "130+ giełd",
    body: "GPW, NYSE, DAX, TSE, NSE i więcej. Wszystko w jednym interfejsie.",
  },
  {
    iconId: "paper",
    title: "Paper Trading",
    body: "Ćwicz bez ryzyka. Ucz się na błędach które nic nie kosztują.",
  },
];

function IconProblemApps(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconProblemBrain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.96-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.96-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2" />
    </svg>
  );
}

function IconProblemTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function SolutionCardIcon({ id, className }: { id: SolutionIconId; className?: string }) {
  const cn = className ?? "h-7 w-7";
  switch (id) {
    case "brief":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "coach":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "dna":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M2 15c6.667-6 13.333 0 20-6" />
          <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
          <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
          <path d="m17 6-2.5-2.5" />
          <path d="m14 8-1-1" />
          <path d="m7 18 2.5 2.5" />
          <path d="m10 16 1 1" />
        </svg>
      );
    case "premortem":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "globe":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "paper":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
  }
}

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

type HeroTicker = (typeof HERO_TICKERS)[number];

const INITIAL_HERO_PRICES: Record<HeroTicker, number> = {
  AAPL: 300.23,
  MSFT: 421.92,
  GOOGL: 396.78,
  AMZN: 265.82,
  NVDA: 220.78,
  TSLA: 433.45,
  META: 603.0,
  JPM: 304.88,
  XOM: 150.63,
  V: 326.42,
};

type BillingCycle = "monthly" | "yearly";

const marqueeItems = [
  "130+ giełd",
  "27 modułów AI",
  "9 języków",
  "100% ad-free",
  "GPW + NYSE + DAX",
];

const TICKER_BAR_ITEMS = [
  { symbol: "AAPL", price: "$300.23", change: "+0.78%", positive: true },
  { symbol: "MSFT", price: "$421.92", change: "+1.85%", positive: true },
  { symbol: "GOOGL", price: "$396.78", change: "+0.12%", positive: true },
  { symbol: "NVDA", price: "$220.78", change: "+1.02%", positive: true },
  { symbol: "BTC", price: "$67,420", change: "+2.34%", positive: true },
  { symbol: "ETH", price: "$3,280", change: "+1.56%", positive: true },
  { symbol: "EUR/USD", price: "1.0842", change: "-0.12%", positive: false },
  { symbol: "USD/PLN", price: "3.9234", change: "+0.08%", positive: true },
  { symbol: "WIG20", price: "2,234", change: "+0.45%", positive: true },
  { symbol: "DAX", price: "18,340", change: "+0.67%", positive: true },
  { symbol: "S&P500", price: "5,234", change: "+0.89%", positive: true },
] as const;

function useCounter(target: number, duration = 2000): { count: number; ref: RefObject<HTMLDivElement> } {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null!);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        const start = Date.now();
        const timer = window.setInterval(() => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress >= 1) window.clearInterval(timer);
        }, 16);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return { count, ref };
}

export function LandingPage() {
  const { t } = useTranslation("common");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<"pro" | "pro_plus" | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  const [heroPrices, setHeroPrices] = useState<Record<HeroTicker, number>>(() => ({ ...INITIAL_HERO_PRICES }));
  const [heroPctByTicker, setHeroPctByTicker] = useState<Partial<Record<HeroTicker, number>>>({});
  const [flashTicker, setFlashTicker] = useState<HeroTicker | null>(null);

  const exchangesCounter = useCounter(130);
  const modulesCounter = useCounter(27);
  const langsCounter = useCounter(9);
  const investorsCounter = useCounter(1200);

  useEffect(() => {
    document.title = "StockAI Pro — Platforma inwestycyjna nowej generacji";
  }, []);

  useEffect(() => {
    const onScroll = (): void => {
      setNavScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroPrices((prev) => {
        const keys = [...HERO_TICKERS];
        const randomKey = keys[Math.floor(Math.random() * keys.length)]!;
        const oldVal = prev[randomKey];
        const change = (Math.random() - 0.48) * 2;
        const newVal = Number.parseFloat((oldVal * (1 + change / 100)).toFixed(2));
        const pct = oldVal > 0 ? ((newVal - oldVal) / oldVal) * 100 : 0;
        queueMicrotask(() => {
          setHeroPctByTicker((p) => ({ ...p, [randomKey]: pct }));
          setFlashTicker(randomKey);
          window.setTimeout(() => setFlashTicker(null), 500);
        });
        return { ...prev, [randomKey]: newVal };
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  const pricingFeatures = (featuresKey: string): string[] => {
    const translated = t(featuresKey, { returnObjects: true });
    if (Array.isArray(translated)) {
      return translated.filter((item): item is string => typeof item === "string");
    }
    return [];
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".reveal, .reveal-left, .reveal-right").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

  const marqueeTrack = [...marqueeItems, ...marqueeItems];
  const tickerMarqueeTrack = [...TICKER_BAR_ITEMS, ...TICKER_BAR_ITEMS];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <SEOHead
        title="StockAI Pro — Platforma inwestycyjna nowej generacji"
        description="Analiza akcji z AI, coaching behawioralny i ponad 130 giełd — GPW, NYSE, DAX i więcej w jednym miejscu."
        ogType="website"
      />

      {/* ═══ TICKER BAR (demo quotes) ═══ */}
      <div
        className="h-10 overflow-hidden bg-[#0A0A0F]"
        aria-label="Przykładowe notowania rynkowe — dane demo"
      >
        <div className="animate-marquee-ticker flex h-10 w-max items-center whitespace-nowrap">
          {tickerMarqueeTrack.map((row, i) => (
            <span key={`${row.symbol}-${i}`} className="inline-flex shrink-0 items-center">
              <span className="inline-flex items-center gap-2 px-4">
                <span className="text-xs text-white/60">{row.symbol}</span>
                <span className="font-mono text-xs text-white">{row.price}</span>
                <span
                  className={`text-xs font-medium ${row.positive ? "text-emerald-400" : "text-red-400"}`}
                >
                  {row.change}
                </span>
              </span>
              <span className="select-none text-white/20" aria-hidden>
                |
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ NAVBAR ═══ */}
      <header
        className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-shadow duration-300 ${
          navScrolled ? "shadow-md" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:py-4">
          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="StockAI Pro — strona główna">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #2D0A6B, #7A0F9E)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                <polyline
                  points="22 7 13.5 15.5 8.5 10.5 2 17"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="16 7 22 7 22 13"
                  stroke="#00C9D4"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-xl font-black" style={{ color: "#2D0A6B" }}>
              Stock<span style={{ color: "#00C9D4" }}>AI</span>
              <span className="font-light"> Pro</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-10 text-sm font-semibold text-[#2D0A6B]/90 md:flex">
            <a href="#problem" className="transition hover:text-[#00C9D4]">
              Problem
            </a>
            <a href="#solution" className="transition hover:text-[#00C9D4]">
              Rozwiązanie
            </a>
            <a href="#pricing" className="transition hover:text-[#00C9D4]">
              Cennik
            </a>
            <Link to="/companies" className="transition hover:text-[#00C9D4]">
              Rynki
            </Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <div className="[&_button]:border-slate-200 [&_button]:text-[#2D0A6B]">
              <LanguageSwitcher />
            </div>
            <Link
              to="/login"
              className="rounded-full border border-[#2D0A6B]/25 px-4 py-2 text-sm font-semibold text-[#2D0A6B] transition hover:bg-[#2D0A6B]/5"
            >
              {t("auth.loginButton", { defaultValue: "Zaloguj" })}
            </Link>
            <Link
              to="/register"
              className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 md:px-6"
              style={{ backgroundColor: BRAND.dark }}
            >
              Zacznij za darmo
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="hero-gradient-bg relative isolate flex min-h-screen items-center overflow-hidden pt-20">
        <div
          className="animate-float pointer-events-none absolute left-10 top-10 z-0 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #7A0F9E, transparent)" }}
          aria-hidden
        />
        <div
          className="animate-float pointer-events-none absolute right-0 top-1/2 z-0 h-[400px] w-[400px] -translate-y-1/2 rounded-full opacity-15 blur-3xl [animation-delay:2s]"
          style={{ background: "radial-gradient(circle, #00C9D4, transparent)" }}
          aria-hidden
        />
        <div
          className="animate-float pointer-events-none absolute bottom-0 left-1/3 z-0 h-[300px] w-[300px] rounded-full opacity-10 blur-3xl [animation-delay:4s]"
          style={{ background: "radial-gradient(circle, #FFAE33, transparent)" }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[3fr_2fr] lg:gap-12 lg:py-20">
          {/* Left column */}
          <div className="flex flex-col justify-center">
            <span
              className="landing-hero-badge mb-6 inline-flex w-fit items-center rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide"
              style={{
                backgroundColor: `${BRAND.dark}14`,
                borderColor: `${BRAND.dark}33`,
                color: BRAND.dark,
              }}
            >
              AI-powered · 130+ giełd · 9 języków
            </span>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-[#1e1b4b] sm:text-6xl lg:text-7xl">
              <span className="landing-hero-h1-line1 block">Inwestuj mądrzej.</span>
              <span className="landing-hero-h1-line2 mt-1 block" style={{ color: BRAND.cyan }}>
                Nie więcej.
              </span>
            </h1>

            <p className="landing-hero-sub mt-6 max-w-lg text-xl leading-relaxed text-slate-600">
              Jedna platforma zamiast pięciu kart w przeglądarce. AI analizuje, coach pilnuje Twoich emocji — Ty
              podejmujesz świadome decyzje.
            </p>

            <div className="landing-hero-cta mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:opacity-95"
                style={{ backgroundColor: BRAND.dark }}
              >
                Zacznij za darmo →
              </Link>
              <a
                href="#solution"
                className="inline-flex items-center gap-2 rounded-full border border-[#2D0A6B]/20 px-6 py-4 text-lg font-semibold text-[#2D0A6B] transition hover:bg-[#2D0A6B]/5"
              >
                Zobacz demo
              </a>
            </div>

            <div className="landing-hero-trust mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-2 ring-white"
                  style={{ backgroundColor: BRAND.medium }}
                >
                  K
                </span>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-2 ring-white"
                  style={{ backgroundColor: BRAND.cyan }}
                >
                  M
                </span>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ring-2 ring-white"
                  style={{ backgroundColor: BRAND.dark }}
                >
                  A
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600">
                Dołącz do <span className="font-bold text-[#2D0A6B]">1,200+</span> inwestorów
              </p>
            </div>
          </div>

          {/* Right column — animated demo prices */}
          <div className="landing-hero-dashboard flex flex-col justify-center">
            <div
              className="relative overflow-hidden rounded-2xl shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #0f0f1a 0%, #1a0533 50%, #0a1628 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Puls rynku na żywo</h2>
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {HERO_TICKERS.map((ticker) => {
                    const price = heroPrices[ticker];
                    const rawPct = heroPctByTicker[ticker];
                    const pct = rawPct ?? 0;
                    const showPct = rawPct !== undefined;
                    return (
                      <div
                        key={ticker}
                        className={`rounded-lg p-3 transition-all duration-500 hover:bg-white/5 ${
                          flashTicker === ticker ? "price-updated" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs text-gray-400">{ticker}</span>
                          <span
                            className={`text-xs font-medium tabular-nums ${showPct && pct >= 0 ? "text-emerald-400" : showPct ? "text-red-400" : "text-gray-500"}`}
                          >
                            {showPct ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                          </span>
                        </div>
                        <p className="mt-1 text-lg font-bold tabular-nums text-white transition-all duration-500">
                          {price.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-gray-400">Scroll</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF MARQUEE (flush under hero, zero vertical gap) ═══ */}
      <section className="mt-0 overflow-hidden py-4" style={{ backgroundColor: BRAND.dark }}>
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap px-4 text-sm font-semibold text-white md:text-base">
          {marqueeTrack.map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex items-center gap-8">
              <span>{item}</span>
              <span style={{ color: BRAND.cyan }} aria-hidden>
                ·
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* ═══ STATS COUNTERS ═══ */}
      <section className="border-y border-gray-100 bg-white py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-10 px-4 md:grid-cols-4 md:gap-8">
          <div ref={exchangesCounter.ref} className="text-center">
            <div className="text-5xl font-black text-[#2D0A6B]">{exchangesCounter.count}+</div>
            <p className="mt-2 text-slate-600">giełd</p>
          </div>
          <div ref={modulesCounter.ref} className="text-center">
            <div className="text-5xl font-black text-[#2D0A6B]">{modulesCounter.count}</div>
            <p className="mt-2 text-slate-600">modułów AI</p>
          </div>
          <div ref={langsCounter.ref} className="text-center">
            <div className="text-5xl font-black text-[#2D0A6B]">{langsCounter.count}</div>
            <p className="mt-2 text-slate-600">języków</p>
          </div>
          <div ref={investorsCounter.ref} className="text-center">
            <div className="text-5xl font-black text-[#2D0A6B]">
              {investorsCounter.count.toLocaleString("pl-PL")}+
            </div>
            <p className="mt-2 text-slate-600">inwestorów</p>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section id="problem" className="scroll-mt-24 bg-white px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl">Czy to brzmi znajomo?</h2>
          <p className="mt-4 text-lg text-slate-600">Każdy retail inwestor zmaga się z tym samym.</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
          {(
            [
              {
                icon: "apps" as const,
                title: "5 aplikacji. Jeden chaos.",
                body: "TradingView, Finviz, broker, Excel, Discord — otwarte jednocześnie. Decyzje na fragmentarycznych danych.",
              },
              {
                icon: "brain" as const,
                title: "Emocje niszczą portfel.",
                body: "Strach, chciwość, FOMO. Badania potwierdzają — 80% strat to błędy psychologiczne, nie analityczne.",
              },
              {
                icon: "target" as const,
                title: "Sygnał bez kontekstu.",
                body: "Widzisz setup ale nie wiesz: czy rynek sprzyja? Czy to właściwy moment? Czy masz przewagę?",
              },
            ] as const
          ).map((card, index) => {
            const staggerClass = index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
            return (
              <article
                key={card.title}
                className={`reveal group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl ${staggerClass}`}
              >
                <div className="absolute left-8 right-8 top-0 h-[3px] rounded-b-full bg-red-500/90" />
                <div
                  className="mb-6 mt-4 flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #fee2e2, #fecaca)" }}
                >
                  {card.icon === "apps" ? (
                    <IconProblemApps className="h-8 w-8 shrink-0 text-red-500" />
                  ) : card.icon === "brain" ? (
                    <IconProblemBrain className="h-8 w-8 shrink-0 text-red-500" />
                  ) : (
                    <IconProblemTarget className="h-8 w-8 shrink-0 text-red-500" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-slate-600">{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ SOLUTION ═══ */}
      <section id="solution" className="scroll-mt-24 bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl">
            Jedno miejsce.
            <br />
            <span style={{ color: BRAND.cyan }}>Pełny obraz.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            StockAI Pro zastępuje 5 narzędzi i dodaje to czego żadne z nich nie ma.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutionCards.map((card, index) => {
            const revealKind =
              index % 3 === 0 ? "reveal-left" : index % 3 === 2 ? "reveal-right" : "reveal";
            const staggerClass =
              index % 3 === 0 ? "stagger-1" : index % 3 === 1 ? "stagger-2" : "stagger-3";
            return (
              <article
                key={card.title}
                className={`${revealKind} rounded-xl border-x border-b border-gray-100 border-t-[3px] bg-white p-6 shadow-sm transition hover:border-[#00C9D4] hover:shadow-lg ${staggerClass}`}
                style={{ borderTopColor: BRAND.cyan }}
              >
                <div
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #e0f7fa, #b2ebf2)" }}
                >
                  <SolutionCardIcon id={card.iconId} className="h-7 w-7 shrink-0 text-[#00C9D4]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-20">
        <h2 className="text-center text-4xl font-bold text-slate-900 sm:text-5xl">Jak to działa?</h2>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            className="absolute left-[16.67%] right-[16.67%] top-6 hidden h-0 border-t-2 border-dashed md:block"
            style={{ borderColor: `${BRAND.cyan}4d` }}
          />
          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            {[
              {
                step: "1",
                title: "Zarejestruj się",
                desc: "30 sekund. Bez karty kredytowej.",
              },
              {
                step: "2",
                title: "Wybierz rynek",
                desc: "GPW, US, DAX — lub wszystkie naraz.",
              },
              {
                step: "3",
                title: "Inwestuj mądrzej",
                desc: "AI analizuje, coach uczy, Ty decydujesz.",
              },
            ].map((item, index) => {
              const staggerClass =
                index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
              return (
                <div
                  key={item.step}
                  className={`reveal relative z-10 flex flex-col items-center text-center ${staggerClass}`}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: BRAND.dark }}
                  >
                    {item.step}
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ETORO PARTNER ═══ */}
      <section className="border-y border-slate-100 bg-white px-4 py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-slate-50/90 p-8 shadow-sm">
          <p className="text-center text-sm font-semibold text-slate-800">{t("etoro.subtitle")}</p>
          <EtoroCTAButton sourcePage="landing_page" className="mx-auto mt-4 max-w-sm" />
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="bg-gray-50 px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {[
            {
              quote:
                "Kiedyś skakałam między 5 aplikacjami. Teraz mam jeden ekran i wiem co robię.",
              initials: "K",
              name: "Kasia",
              loc: "Warszawa",
            },
            {
              quote:
                "Behavioral Coach pokazał mi że traciłem przez FOMO, nie przez złe sygnały.",
              initials: "L",
              name: "Lukas",
              loc: "Berlin",
            },
            {
              quote:
                "Pre-Mortem AI zmienił moje podejście do ryzyka. Teraz myślę zanim klikam.",
              initials: "C",
              name: "Clara",
              loc: "Madryt",
            },
          ].map((item, index) => {
            const staggerClass = index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
            return (
              <blockquote
                key={item.name}
                className={`reveal relative rounded-2xl p-8 ${staggerClass}`}
                style={{
                  background: "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 8px 32px rgba(45,10,107,0.08)",
                }}
              >
                <p
                  className="pointer-events-none absolute left-6 top-4 font-serif text-7xl opacity-30"
                  style={{ color: BRAND.cyan }}
                  aria-hidden
                >
                  &ldquo;
                </p>
                <p className="relative z-10 text-lg leading-relaxed text-slate-900">{item.quote}</p>
                <footer className="relative z-10 mt-6 flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.dark}, ${BRAND.medium})`,
                    }}
                  >
                    {item.initials}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.loc}</div>
                  </div>
                </footer>
              </blockquote>
            );
          })}
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="scroll-mt-24 bg-white px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-bold text-slate-900 sm:text-5xl">Prosty cennik.</h2>

          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                  billingCycle === "monthly" ? "text-white shadow-md" : "text-slate-600 hover:text-slate-900"
                }`}
                style={
                  billingCycle === "monthly"
                    ? { backgroundColor: BRAND.dark }
                    : { backgroundColor: "transparent" }
                }
              >
                {t("landing.pricing.monthly", { defaultValue: "Miesięcznie" })}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                  billingCycle === "yearly" ? "text-white shadow-md" : "text-slate-600 hover:text-slate-900"
                }`}
                style={
                  billingCycle === "yearly" ? { backgroundColor: BRAND.dark } : { backgroundColor: "transparent" }
                }
              >
                {t("landing.pricing.yearly", { defaultValue: "Rocznie" })}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm font-medium text-slate-700">
            ⚡ Pierwsze 500 kont Pro w cenie $9/mo — na zawsze
          </p>

          <div className="mt-14 grid items-center gap-8 lg:grid-cols-3">
            {pricingTiers.map((tier) => {
              const isPro = tier.id === "pro";
              const isFree = tier.id === "free";
              const isProPlus = tier.id === "proPlus";

              const priceDisplay =
                tier.id === "free"
                  ? "$0/mo"
                  : tier.id === "pro"
                    ? billingCycle === "monthly"
                      ? "$9/mo"
                      : "$79/yr"
                    : billingCycle === "monthly"
                      ? "$19/mo"
                      : "$149/yr";

              if (isPro) {
                return (
                  <article
                    key={tier.id}
                    className="relative z-10 order-first rounded-2xl p-8 text-white lg:order-none lg:scale-105"
                    style={{
                      background: "linear-gradient(135deg, #2D0A6B 0%, #7A0F9E 100%)",
                      boxShadow:
                        "0 0 60px rgba(122,15,158,0.4), 0 20px 40px rgba(45,10,107,0.3)",
                    }}
                  >
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
                      style={{ background: "#00C9D4", color: "#0A0A0F" }}
                    >
                      Najpopularniejszy
                    </span>
                    <h3 className="mt-4 text-xl font-bold">{t(tier.nameKey)}</h3>
                    <p className="mt-6 text-5xl font-bold">{priceDisplay}</p>
                    <p className="mt-2 font-semibold" style={{ color: BRAND.cyan }}>
                      14 dni za darmo
                    </p>
                    {billingCycle === "yearly" ? (
                      <p className="mt-2 text-sm font-semibold text-emerald-300">
                        {t("landing.pricing.save", { defaultValue: "Save 27%" })}
                      </p>
                    ) : null}
                    <p className="mt-4 text-sm text-white/80">{t(tier.bodyKey)}</p>
                    <ul className="mt-6 space-y-2 text-sm text-white/95">
                      {pricingFeatures(tier.featuresKey).map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-[#FFAE33]">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => void handleChoosePlan("pro")}
                      disabled={checkoutLoadingPlan !== null}
                      className="mt-8 w-full rounded-full bg-white py-3 text-center text-sm font-bold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ color: BRAND.dark }}
                    >
                      {checkoutLoadingPlan === "pro"
                        ? t("common.loading", { defaultValue: "Loading..." })
                        : t(tier.ctaKey)}
                    </button>
                  </article>
                );
              }

              return (
                <article
                  key={tier.id}
                  className={`rounded-2xl border bg-white p-8 ${
                    isProPlus ? "border-2 shadow-md" : "border-gray-200 shadow-sm"
                  }`}
                  style={isProPlus ? { borderColor: BRAND.medium } : undefined}
                >
                  <h3 className="text-xl font-bold text-slate-900">{t(tier.nameKey)}</h3>
                  <p className={`mt-6 font-bold ${isFree ? "text-4xl" : "text-4xl"}`} style={{ color: BRAND.dark }}>
                    {priceDisplay}
                  </p>
                  {tier.id === "proPlus" && billingCycle === "yearly" ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-600">
                      {t("landing.pricing.saveProPlus", { defaultValue: "Save 34%" })}
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm text-slate-600">{t(tier.bodyKey)}</p>
                  <ul className="mt-6 space-y-2 text-sm text-slate-700">
                    {pricingFeatures(tier.featuresKey).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span style={{ color: BRAND.cyan }}>✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.id === "free" ? (
                    <Link
                      to="/register"
                      className="mt-8 inline-flex w-full justify-center rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                    >
                      {t(tier.ctaKey)}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleChoosePlan("pro_plus")}
                      disabled={checkoutLoadingPlan !== null}
                      className="mt-8 w-full rounded-full border-2 py-3 text-sm font-bold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderColor: BRAND.medium, color: BRAND.dark }}
                    >
                      {checkoutLoadingPlan === "pro_plus"
                        ? t("common.loading", { defaultValue: "Loading..." })
                        : t(tier.ctaKey)}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section
        className="px-4 py-20 text-center text-white"
        style={{
          background: `linear-gradient(135deg, ${BRAND.dark} 0%, ${BRAND.medium} 100%)`,
        }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">Gotowy żeby inwestować mądrzej?</h2>
          <p className="mt-4 text-lg text-white">
            Zacznij za darmo — bez karty kredytowej. Upgrade w każdej chwili.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex rounded-full bg-white px-8 py-4 text-lg font-semibold shadow-xl transition hover:bg-slate-100"
              style={{ color: BRAND.dark }}
            >
              Zacznij za darmo →
            </Link>
            <a
              href="#pricing"
              className="inline-flex rounded-full border-2 border-white/40 px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
            >
              Zobacz cennik
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="text-white" style={{ backgroundColor: BRAND.dark }}>
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white">
                Stock<span className="text-[#00C9D4]">AI</span>
              </span>
              <span className="text-2xl font-semibold text-white/80">Pro</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Jedna platforma. Pełny obraz rynku. AI i coaching behawioralny dla świadomych inwestorów.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">Produkt</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/companies" className="text-white/60 transition hover:text-white">
                  Rynki
                </Link>
              </li>
              <li>
                <Link to="/signals" className="text-white/60 transition hover:text-white">
                  Sygnały
                </Link>
              </li>
              <li>
                <a href="#pricing" className="text-white/60 transition hover:text-white">
                  Cennik
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">Firma</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#solution" className="text-white/60 transition hover:text-white">
                  Rozwiązanie
                </a>
              </li>
              <li>
                <a
                  href={ETORO_AFFILIATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 transition hover:text-white"
                >
                  Handel z eToro (partner)
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-white">Legal</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <span className="text-white/60">Regulamin — wkrótce</span>
              </li>
              <li>
                <span className="text-white/60">Polityka prywatności — wkrótce</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-white/50 md:flex-row">
            <p>© 2026 StockAI Pro · All rights reserved</p>
            <div className="flex gap-3 text-lg" aria-label="Języki">
              <span title="Polski">🇵🇱</span>
              <span title="English">🇬🇧</span>
              <span title="Deutsch">🇩🇪</span>
              <span title="Español">🇪🇸</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
