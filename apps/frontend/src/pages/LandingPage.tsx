import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createStripeCheckoutSession, getLatestLiveQuote } from "../services/api";
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

const solutionCards = [
  {
    icon: "🤖",
    title: "AI Brief z narracją",
    body: "Nie sam score — pełne wyjaśnienie dlaczego warto lub nie. Claude Sonnet analizuje za Ciebie.",
  },
  {
    icon: "🧠",
    title: "Behavioral Coach",
    body: "Wykrywa wzorce Twoich błędów i interweniuje zanim popełnisz kolejny.",
  },
  {
    icon: "🧬",
    title: "Signal DNA",
    body: "Historyczne bliźniaki setupu. Jak ten układ kończył się w przeszłości — ze statystykami.",
  },
  {
    icon: "⚠️",
    title: "Pre-Mortem AI",
    body: "Zanim kupisz — AI pokazuje najbardziej prawdopodobny scenariusz straty.",
  },
  {
    icon: "🌍",
    title: "130+ giełd",
    body: "GPW, NYSE, DAX, TSE, NSE i więcej. Wszystko w jednym interfejsie.",
  },
  {
    icon: "🎮",
    title: "Paper Trading",
    body: "Ćwicz bez ryzyka. Ucz się na błędach które nic nie kosztują.",
  },
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

const marqueeItems = [
  "130+ giełd",
  "27 modułów AI",
  "9 języków",
  "100% ad-free",
  "GPW + NYSE + DAX",
];

function toNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function changeBadgeClass(changePct: number | null): string {
  if (changePct == null) return "bg-slate-100 text-slate-500";
  return changePct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
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
  const [navScrolled, setNavScrolled] = useState(false);

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

  const marqueeTrack = [...marqueeItems, ...marqueeItems];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <SEOHead
        title="StockAI Pro — Platforma inwestycyjna nowej generacji"
        description="Analiza akcji z AI, coaching behawioralny i ponad 130 giełd — GPW, NYSE, DAX i więcej w jednym miejscu."
        ogType="website"
      />
      {/* ═══ NAVBAR ═══ */}
      <header
        className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-shadow duration-300 ${
          navScrolled ? "shadow-md" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:py-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img
              src="/logo.png"
              alt="StockAI Pro"
              className="h-10 w-auto max-w-[200px] object-contain md:h-12 md:max-w-[240px]"
            />
            <span className="hidden font-bold text-xl text-[#2D0A6B] sm:inline" aria-hidden="true">
              StockAI Pro
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

      {/* ═══ HERO — tight to marquee below; content anchored low to avoid dead space above bar ═══ */}
      <section className="relative isolate flex min-h-[85vh] flex-col justify-end overflow-hidden pb-0">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(45, 10, 107, 0.06), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(0, 201, 212, 0.06), transparent 50%), #ffffff",
          }}
        />

        <svg
          className="pointer-events-none absolute -right-24 top-24 -z-10 h-96 w-96 animate-float opacity-[0.05]"
          aria-hidden
          viewBox="0 0 200 200"
        >
          <circle cx="100" cy="100" r="90" fill={BRAND.dark} />
        </svg>
        <svg
          className="pointer-events-none absolute -left-16 bottom-32 -z-10 h-72 w-72 animate-float opacity-[0.05] [animation-delay:1s]"
          aria-hidden
          viewBox="0 0 200 200"
        >
          <ellipse cx="100" cy="100" rx="95" ry="70" fill={BRAND.medium} />
        </svg>

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pb-3 pt-10 sm:gap-10 sm:pb-4 sm:pt-14 lg:grid-cols-[3fr_2fr] lg:gap-12 lg:pb-5 lg:pt-16">
          {/* Left column */}
          <div className="flex flex-col justify-center">
            <span
              className="mb-6 inline-flex w-fit items-center rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide"
              style={{
                backgroundColor: `${BRAND.dark}14`,
                borderColor: `${BRAND.dark}33`,
                color: BRAND.dark,
              }}
            >
              🚀 AI-powered · 130+ giełd · 9 języków
            </span>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-[#1e1b4b] sm:text-6xl lg:text-7xl">
              Inwestuj mądrzej.
              <br />
              <span style={{ color: BRAND.cyan }}>Nie więcej.</span>
            </h1>

            <p className="mt-6 max-w-lg text-xl leading-relaxed text-slate-600">
              Jedna platforma zamiast pięciu kart w przeglądarce. AI analizuje, coach pilnuje Twoich emocji — Ty
              podejmujesz świadome decyzje.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
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
                Zobacz demo ▶
              </a>
            </div>

            <div className="mt-10 flex items-center gap-4">
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

          {/* Right column — Live preview */}
          <div className="flex flex-col justify-center">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">Puls rynku na żywo</h2>
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {displayedQuotes.map((row, index) => (
                  <div
                    key={row.ticker}
                    className="opacity-0 animate-fadeInUp rounded-xl border border-gray-100 bg-slate-50/80 p-3 transition-transform hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 0.1}s`, animationFillMode: "forwards" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{row.ticker}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${changeBadgeClass(row.changePct)}`}
                      >
                        {row.changePct == null ? "—" : `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                      {row.price == null ? "—" : row.price.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              {quotesLoading ? (
                <p className="mt-3 text-center text-xs text-slate-400">{t("common.loading")}</p>
              ) : null}
            </div>
          </div>
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

      {/* ═══ PROBLEM ═══ */}
      <section id="problem" className="scroll-mt-24 bg-white px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl">Czy to brzmi znajomo?</h2>
          <p className="mt-4 text-lg text-slate-600">Każdy retail inwestor zmaga się z tym samym.</p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
          {[
            {
              emoji: "📱",
              title: "5 aplikacji. Jeden chaos.",
              body: "TradingView, Finviz, broker, Excel, Discord — otwarte jednocześnie. Decyzje na fragmentarycznych danych.",
            },
            {
              emoji: "😰",
              title: "Emocje niszczą portfel.",
              body: "Strach, chciwość, FOMO. Badania potwierdzają — 80% strat to błędy psychologiczne, nie analityczne.",
            },
            {
              emoji: "🎯",
              title: "Sygnał bez kontekstu.",
              body: "Widzisz setup ale nie wiesz: czy rynek sprzyja? Czy to właściwy moment? Czy masz przewagę?",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="group relative rounded-2xl border border-gray-100 bg-white p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute left-8 right-8 top-0 h-[3px] rounded-b-full bg-red-500/90" />
              <div
                className="mt-4 flex h-[72px] w-[72px] items-center justify-center rounded-full text-4xl"
                style={{ backgroundColor: `${BRAND.dark}14` }}
              >
                {card.emoji}
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">{card.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-600">{card.body}</p>
            </article>
          ))}
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
          {solutionCards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border-x border-b border-gray-100 border-t-[3px] bg-white p-6 shadow-sm transition hover:border-[#00C9D4] hover:shadow-lg"
              style={{ borderTopColor: BRAND.cyan }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${BRAND.cyan}26`, color: BRAND.cyan }}
              >
                {card.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
            </article>
          ))}
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
            ].map((item) => (
              <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: BRAND.dark }}
                >
                  {item.step}
                </div>
                <h3 className="mt-6 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
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
      <section className="bg-slate-50 px-4 py-20">
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
          ].map((item) => (
            <blockquote key={item.name} className="rounded-2xl bg-white p-8 shadow-md">
              <p className="font-serif text-6xl leading-none" style={{ color: BRAND.cyan }}>
                &ldquo;
              </p>
              <p className="-mt-2 text-lg italic leading-relaxed text-slate-800">{item.quote}</p>
              <footer className="mt-6 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: BRAND.dark }}
                >
                  {item.initials}
                </span>
                <div>
                  <div className="font-bold text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-500">{item.loc}</div>
                </div>
              </footer>
            </blockquote>
          ))}
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
                    className="relative z-10 order-first rounded-2xl p-8 text-white shadow-2xl lg:order-none lg:scale-105"
                    style={{ backgroundColor: BRAND.dark }}
                  >
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
                      style={{ backgroundColor: BRAND.cyan, color: BRAND.dark }}
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
          <h2 className="text-4xl font-bold sm:text-5xl">Gotowy żeby inwestować mądrzej?</h2>
          <p className="mt-4 text-lg text-white/80">
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
            <img src="/logo.png" alt="StockAI Pro" className="h-9 w-36 object-contain brightness-0 invert" />
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
