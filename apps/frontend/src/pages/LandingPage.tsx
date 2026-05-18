import {
  type SVGProps,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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


const LANDING_ICONA = {
  problemApps: "/icons/icona/problem-apps.png",
  problemBrain: "/icons/icona/problem-brain.png",
  problemTarget: "/icons/icona/problem-target.png",
  howSteps: ["/icons/icona/how-step-1.png", "/icons/icona/how-step-2.png", "/icons/icona/how-step-3.png"],
} as const;

const SOLUTION_ICON_SRC: Record<SolutionIconId, string> = {
  brief: "/icons/icona/solution-brief.png",
  coach: "/icons/icona/solution-coach.png",
  dna: "/icons/icona/solution-dna.png",
  premortem: "/icons/icona/solution-premortem.png",
  globe: "/icons/icona/solution-globe.png",
  paper: "/icons/icona/solution-paper.png",
};

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

function SignalWave({
  offset = 0,
  opacity = 0.08,
  color = BRAND.cyan,
}: {
  offset?: number;
  opacity?: number;
  color?: string;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 z-0 h-[120px] w-full overflow-visible"
      style={{ top: offset, opacity }}
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 C1200,20 1320,100 1440,60"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={2000}
        strokeDashoffset={2000}
        vectorEffect="nonScalingStroke"
        className="signal-wave-path"
      />
    </svg>
  );
}

function ParticleDots() {
  const dots = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        x: ((i * 47) % 93) + 3,
        y: ((i * 71) % 88) + 6,
        size: 1 + (i % 4) * 0.65,
        delay: (i * 0.21) % 3,
        duration: 2 + (i % 5) * 0.35,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {dots.map((dot, i) => (
        <div
          key={i}
          className="animate-float absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            background: "rgba(255,255,255,0.3)",
            animationDelay: `${dot.delay}s`,
            animationDuration: `${dot.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function IconStatGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconStatCircuit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6v6H9z" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

function IconStatLang(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconStatUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const HOW_IT_WORKS_STEPS = [
  { step: "1", title: "Zarejestruj się", desc: "30 sekund. Bez karty kredytowej." },
  { step: "2", title: "Wybierz rynek", desc: "GPW, US, DAX — lub wszystkie naraz." },
  { step: "3", title: "Inwestuj mądrzej", desc: "AI analizuje, coach uczy, Ty decydujesz." },
] as const;

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

const CANDLES_DEMO = [
  { x: 20, open: 60, close: 40, high: 30, low: 70, bull: true },
  { x: 50, open: 40, close: 25, high: 15, low: 50, bull: true },
  { x: 80, open: 35, close: 50, high: 25, low: 60, bull: false },
  { x: 110, open: 45, close: 30, high: 20, low: 55, bull: true },
  { x: 140, open: 30, close: 15, high: 8, low: 38, bull: true },
  { x: 170, open: 20, close: 35, high: 12, low: 42, bull: false },
  { x: 200, open: 30, close: 18, high: 10, low: 38, bull: true },
  { x: 230, open: 22, close: 8, high: 2, low: 28, bull: true },
] as const;

function HowItWorksStepBadge({ stepIndex }: { stepIndex: number }) {
  const label = String(stepIndex + 1);

  const shell =
    "landing-how-float relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-visible rounded-2xl ring-2 ring-white/30";

  const numBadge = (
    <span
      className="absolute -bottom-2 -right-2 flex h-9 min-w-[2.25rem] items-center justify-center rounded-full bg-white px-2 text-sm font-black shadow-lg"
      style={{ color: BRAND.dark, boxShadow: "0 10px 28px rgba(45,10,107,0.22)" }}
      aria-hidden
    >
      {label}
    </span>
  );

  const palettes = [
    {
      background: `linear-gradient(145deg, ${BRAND.dark} 0%, ${BRAND.medium} 100%)`,
      boxShadow: "0 0 38px rgba(122,15,158,0.42)",
    },
    {
      background: `linear-gradient(145deg, ${BRAND.medium} 0%, ${BRAND.dark} 100%)`,
      boxShadow: "0 0 38px rgba(122,15,158,0.42)",
    },
    {
      background: `linear-gradient(145deg, ${BRAND.dark} 0%, ${BRAND.medium} 70%, #0e7490 100%)`,
      boxShadow: "0 0 40px rgba(0,201,212,0.32)",
    },
  ];
  const style = palettes[stepIndex] ?? palettes[0];

  return (
    <div className={shell} style={style}>
      <img
        src={LANDING_ICONA.howSteps[stepIndex] ?? LANDING_ICONA.howSteps[0]}
        alt=""
        className="h-[62px] w-[62px] object-contain drop-shadow-md"
        decoding="async"
        aria-hidden
      />
      {numBadge}
    </div>
  );
}

function PricingFeatureCheck({ accent }: { accent: "gold" | "cyan" }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="mt-0.5 h-[22px] w-[22px] shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}-chk`} x1="0%" y1="0%" x2="100%" y2="100%">
          {accent === "gold" ? (
            <>
              <stop offset="0%" stopColor="#FFAE33" />
              <stop offset="100%" stopColor="#f59e0b" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#2D0A6B" />
              <stop offset="100%" stopColor="#00C9D4" />
            </>
          )}
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill={`url(#${uid}-chk)`} opacity={0.2} />
      <circle cx="12" cy="12" r="9.5" stroke={`url(#${uid}-chk)`} strokeWidth={1.25} opacity={0.45} />
      <path
        d="M7 12.5 L10.5 16 L17 8.5"
        stroke={`url(#${uid}-chk)`}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CandlestickChart() {
  return (
    <svg viewBox="0 0 280 100" className="h-40 w-full animate-fadeInUp" aria-hidden>
      {CANDLES_DEMO.map((c, i) => (
        <g
          key={i}
          className="animate-fadeInUp opacity-0"
          style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "forwards" }}
        >
          <line
            x1={c.x}
            y1={c.high}
            x2={c.x}
            y2={c.low}
            stroke={c.bull ? "#00A86B" : "#E53935"}
            strokeWidth={1}
            opacity={0.6}
          />
          <rect
            x={c.x - 6}
            y={Math.min(c.open, c.close)}
            width={12}
            height={Math.max(Math.abs(c.close - c.open), 1)}
            fill={c.bull ? "#00A86B" : "#E53935"}
            rx={1}
            opacity={0.8}
          />
        </g>
      ))}
      <polyline
        points="20,55 50,37 80,42 110,32 140,22 170,25 200,18 230,10"
        fill="none"
        stroke="#00C9D4"
        strokeWidth={1.5}
        opacity={0.4}
        strokeDasharray={300}
        strokeDashoffset={300}
        className="chart-draw-line"
      />
    </svg>
  );
}

function FloatingCards() {
  const cardShell =
    "rounded-2xl shadow-[0_8px_32px_rgba(45,10,107,0.15)] border border-[rgba(45,10,107,0.08)] bg-white px-3 py-2 md:px-4 md:py-3";

  return (
    <>
      <div
        className={`animate-float absolute left-2 top-[5.25rem] z-20 origin-top-left scale-[0.78] sm:left-1 sm:top-16 sm:scale-90 md:-left-4 md:scale-100 ${cardShell}`}
        style={{
          animationDelay: "0s",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="pulse-dot h-2 w-2 rounded-full bg-[#00A86B]"
            style={{ boxShadow: "0 0 8px #00A86B" }}
          />
          <span className="text-[11px] font-bold text-[#2D0A6B]">AAPL</span>
          <span className="text-[11px] font-semibold text-[#00A86B]">+2.4% ↑</span>
        </div>
        <div className="mt-0.5 text-[10px] text-[#9B9BB5]">AI Signal: BUY</div>
      </div>

      <div
        className={`animate-float absolute bottom-[7.25rem] right-2 z-20 origin-bottom-right scale-[0.78] sm:bottom-24 sm:right-1 sm:scale-90 md:-right-4 md:scale-100 ${cardShell}`}
        style={{
          animationDelay: "1.5s",
        }}
      >
        <div className="text-[11px] font-bold text-[#2D0A6B]">🧠 Coach Alert</div>
        <div className="mt-0.5 text-[10px] text-[#9B9BB5]">Unikasz FOMO dziś ✓</div>
      </div>

      <div
        className="animate-float absolute right-2 top-[6rem] z-20 origin-top-right scale-[0.78] rounded-2xl px-3 py-2 shadow-[0_8px_32px_rgba(45,10,107,0.3)] sm:right-1 sm:top-6 sm:scale-90 md:right-0 md:top-4 md:scale-100 md:px-4 md:py-3"
        style={{
          animationDelay: "3s",
          background: "linear-gradient(135deg, #2D0A6B, #7A0F9E)",
        }}
      >
        <div className="text-[20px] font-black text-white">73%</div>
        <div className="text-[10px] text-white/60">Win Rate</div>
      </div>
    </>
  );
}

function GlobalConnectionsSVG() {
  const nodes = [
    { x: 80, y: 200, label: "GPW" },
    { x: 200, y: 80, label: "NYSE" },
    { x: 380, y: 150, label: "DAX" },
    { x: 420, y: 320, label: "TSE" },
    { x: 150, y: 380, label: "LSE" },
    { x: 300, y: 280, label: "NSE" },
  ] as const;
  const edges = [
    [80, 200, 200, 80],
    [200, 80, 380, 150],
    [380, 150, 420, 320],
    [420, 320, 150, 380],
    [150, 380, 80, 200],
    [200, 80, 300, 280],
    [300, 280, 380, 150],
    [80, 200, 300, 280],
  ] as const;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ opacity: 0.06 }}
      viewBox="0 0 500 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {nodes.map((node, i) => (
        <g key={i}>
          <title>{node.label}</title>
          <circle cx={node.x} cy={node.y} r={4} fill="#2D0A6B" />
          <circle cx={node.x} cy={node.y} r={8} fill="none" stroke="#2D0A6B" strokeWidth={1} opacity={0.5} />
        </g>
      ))}
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2D0A6B" strokeWidth={0.5} opacity={0.6} />
      ))}
      <circle r={3} fill="#00C9D4" opacity={0.8}>
        <animateMotion dur="3s" repeatCount="indefinite" path="M80,200 L200,80 L380,150 L420,320 L150,380 L80,200" />
      </circle>
      <circle r={2} fill="#FFAE33" opacity={0.6}>
        <animateMotion dur="4s" repeatCount="indefinite" begin="1s" path="M200,80 L300,280 L380,150 L80,200" />
      </circle>
    </svg>
  );
}

type HeroVisualProps = {
  heroPrices: Record<HeroTicker, number>;
  heroPctByTicker: Partial<Record<HeroTicker, number>>;
  flashTicker: HeroTicker | null;
};

function HeroVisual({ heroPrices, heroPctByTicker, flashTicker }: HeroVisualProps) {
  return (
    <div className="landing-hero-dashboard relative h-[520px] w-full">
      <GlobalConnectionsSVG />

      <div className="absolute inset-0 z-[1] flex items-end justify-center opacity-20">
        <CandlestickChart />
      </div>

      <div className="hero-card-glow absolute left-8 right-8 top-8 z-10 rounded-2xl">
        <div
          className="hero-card-glow-inner relative overflow-hidden rounded-[14px] shadow-[0_25px_50px_rgba(45,10,107,0.4),0_0_100px_rgba(0,201,212,0.05)]"
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

      <FloatingCards />
    </div>
  );
}

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
    document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .timeline-line").forEach((el) => observer.observe(el));
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
        className={`relative sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-shadow duration-300 ${
          navScrolled ? "shadow-md" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 md:py-4">
          <Link to="/" className="flex shrink-0 items-center" aria-label="StockAI Pro — strona główna">
            <img
              src="/logo.png"
              alt="StockAI Pro"
              className="h-9 w-auto max-w-[min(100%,280px)] object-contain object-left md:h-10 md:max-w-[320px]"
              decoding="async"
            />
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
        {navScrolled ? (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, #00C9D4 30%, #7A0F9E 70%, transparent)",
            }}
            aria-hidden
          />
        ) : null}
      </header>

      {/* ═══ HERO ═══ */}
      <section className="hero-gradient-bg relative isolate flex min-h-screen items-center overflow-x-hidden pt-20">
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
        <SignalWave offset={320} opacity={0.14} />
        <SignalWave offset={460} opacity={0.09} color="#a78bfa" />

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

            <h1 className="hero-h1 text-[#1e1b4b]">
              <span className="landing-hero-h1-line1 block">Inwestuj mądrzej.</span>
              <span className="landing-hero-h1-line2 mt-1 block" style={{ color: BRAND.cyan }}>
                Nie więcej.
              </span>
            </h1>

            <p className="landing-hero-sub landing-body mt-6 max-w-lg text-slate-600">
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

          {/* Right column — Hero visual */}
          <div className="flex flex-col justify-center">
            <HeroVisual heroPrices={heroPrices} heroPctByTicker={heroPctByTicker} flashTicker={flashTicker} />
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
      <section
        className="relative overflow-hidden border-y border-white/10 py-14 md:py-20"
        style={{
          background: "linear-gradient(135deg, #2D0A6B 0%, #1a0533 50%, #0a1628 100%)",
        }}
      >
        <SignalWave offset={-36} opacity={0.1} color="#67e8f9" />
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-white/10 md:grid-cols-4 md:divide-y-0">
          <div ref={exchangesCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <IconStatGlobe className="mb-3 h-7 w-7 shrink-0" style={{ color: BRAND.cyan }} />
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{exchangesCounter.count}+</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">giełd</p>
          </div>
          <div ref={modulesCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <IconStatCircuit className="mb-3 h-7 w-7 shrink-0" style={{ color: BRAND.cyan }} />
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{modulesCounter.count}</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">modułów AI</p>
          </div>
          <div ref={langsCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <IconStatLang className="mb-3 h-7 w-7 shrink-0" style={{ color: BRAND.cyan }} />
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{langsCounter.count}</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">języków</p>
          </div>
          <div ref={investorsCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <IconStatUsers className="mb-3 h-7 w-7 shrink-0" style={{ color: BRAND.cyan }} />
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">
              {investorsCounter.count.toLocaleString("pl-PL")}+
            </div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">inwestorów</p>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section
        id="problem"
        className="relative scroll-mt-24 overflow-hidden px-4 py-20"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #faf8ff 100%)" }}
      >
        <SignalWave offset={-40} opacity={0.12} />
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
            style={{
              width: "800px",
              height: "400px",
              background: "radial-gradient(ellipse, rgba(122,15,158,0.04) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-slate-900">Czy to brzmi znajomo?</h2>
          <p className="landing-body mt-4 text-slate-600">Każdy retail inwestor zmaga się z tym samym.</p>
        </div>

        <div className="relative z-10 mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
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
                className={`reveal group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 shadow-md transition-all duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 hover:shadow-xl ${staggerClass}`}
              >
                <div className="absolute inset-x-0 top-0 flex justify-start px-8 pt-0">
                  <div className="h-[3px] w-10 rounded-full bg-red-400 transition-all duration-300 ease-out group-hover:w-full" />
                </div>
                <div
                  className="mb-6 mt-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 transition-all duration-300 group-hover:scale-110 group-hover:bg-red-100"
                >
                                    <img
                    src={
                      card.icon === "apps"
                        ? LANDING_ICONA.problemApps
                        : card.icon === "brain"
                          ? LANDING_ICONA.problemBrain
                          : LANDING_ICONA.problemTarget
                    }
                    alt=""
                    className="h-[72px] w-[72px] object-contain"
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                <p className="landing-body mt-3 text-slate-600">{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ SOLUTION ═══ */}
      <section
        id="solution"
        className="relative scroll-mt-24 overflow-hidden px-4 py-20"
        style={{ background: "linear-gradient(180deg, #faf8ff 0%, #f0f9ff 50%, #faf8ff 100%)" }}
      >
        <SignalWave offset={20} opacity={0.1} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-slate-900">
            Jedno miejsce.
            <br />
            <span style={{ color: BRAND.cyan }}>Pełny obraz.</span>
          </h2>
          <p className="landing-body mt-4 text-slate-600">
            StockAI Pro zastępuje 5 narzędzi i dodaje to czego żadne z nich nie ma.
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutionCards.map((card, index) => {
            const revealKind =
              index % 3 === 0 ? "reveal-left" : index % 3 === 2 ? "reveal-right" : "reveal";
            const staggerClass =
              index % 3 === 0 ? "stagger-1" : index % 3 === 1 ? "stagger-2" : "stagger-3";
            return (
              <article
                key={card.title}
                className={`${revealKind} group relative overflow-hidden rounded-xl border border-gray-100 border-t-[3px] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#00C9D4] hover:shadow-lg ${staggerClass}`}
                style={{ borderTopColor: BRAND.cyan }}
              >
                <span
                  className="pointer-events-none absolute right-4 top-4 text-5xl font-black leading-none opacity-[0.05]"
                  style={{ color: BRAND.dark }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div
                  className="relative z-[1] mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #e0f7fa, #b2ebf2)" }}
                >
                  <img
                  src={SOLUTION_ICON_SRC[card.iconId]}
                  alt=""
                  className="h-[52px] w-[52px] object-contain"
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
                </div>
                <h3 className="relative z-[1] text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="landing-body relative z-[1] mt-2 text-slate-600">{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden bg-white px-4 py-20">
        <SignalWave offset={-24} opacity={0.1} />
        <h2 className="section-h2 relative z-10 text-center text-slate-900">Jak to działa?</h2>

        <div className="relative z-10 mx-auto mt-16 md:hidden">
          <div className="mx-auto grid max-w-lg gap-12">
            {HOW_IT_WORKS_STEPS.map((item, index) => {
              const staggerClass =
                index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
              return (
                <div key={item.step} className={`reveal flex flex-col items-center text-center ${staggerClass}`}>
                  <HowItWorksStepBadge stepIndex={index} />
                  <h3 className="mt-8 text-lg font-bold text-slate-900">{item.title}</h3>
                  <p className="landing-body mt-2 text-slate-600">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-16 hidden max-w-5xl md:block">
          <div className="flex items-start justify-between gap-2 px-2">
            {HOW_IT_WORKS_STEPS.map((item, index) => {
              const staggerClass =
                index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
              const connector =
                index < HOW_IT_WORKS_STEPS.length - 1 ? (
                  <div className="flex min-h-[88px] min-w-0 flex-[1] items-center px-2">
                    <div
                      className="timeline-line h-[2px] w-full rounded-full"
                      style={{
                        background:
                          index === 0
                            ? "linear-gradient(90deg, #2D0A6B, #00C9D4)"
                            : "linear-gradient(90deg, #00C9D4, #2D0A6B)",
                      }}
                    />
                  </div>
                ) : null;

              return (
                <div key={item.step} className="contents">
                  <div className={`reveal flex min-w-0 max-w-[30%] flex-[1.15] flex-col items-center text-center ${staggerClass}`}>
                    <HowItWorksStepBadge stepIndex={index} />
                    <h3 className="mt-8 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="landing-body mt-2 text-slate-600">{item.desc}</p>
                  </div>
                  {connector}
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
      <section className="relative overflow-hidden bg-gray-50 px-4 py-20">
        <SignalWave offset={60} opacity={0.1} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-slate-900">Co mówią inwestorzy?</h2>
          <p className="landing-body mt-4 text-slate-600">Krótkie historie z pierwszej linii — Spoiler: mniej chaosu.</p>
        </div>
        <div className="relative z-10 mx-auto mt-14 grid max-w-6xl gap-8 md:grid-cols-3">
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
              <div key={item.name} className={`reveal relative group ${staggerClass}`}>
                <div
                  className="pointer-events-none absolute inset-x-3 bottom-[-8px] -z-10 h-full scale-95 rounded-2xl"
                  style={{
                    background: "rgba(45,10,107,0.08)",
                    filter: "blur(8px)",
                  }}
                  aria-hidden
                />
                <blockquote
                  className="relative z-10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(45,10,107,0.08)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-xl"
                  style={{
                    background: "rgba(255,255,255,0.8)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.9)",
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
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="relative scroll-mt-24 overflow-hidden bg-white px-4 py-20">
        <SignalWave offset={-20} opacity={0.09} />
        <div className="relative z-10 mx-auto max-w-6xl">
          <h2 className="section-h2 text-center text-slate-900">Prosty cennik.</h2>

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
                          <PricingFeatureCheck accent="gold" />
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
                        <PricingFeatureCheck accent="cyan" />
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
        className="relative overflow-hidden px-4 py-20 text-center text-white"
        style={{
          background: `linear-gradient(135deg, ${BRAND.dark} 0%, ${BRAND.medium} 100%)`,
        }}
      >
        <ParticleDots />
        <div className="relative z-10 mx-auto max-w-3xl">
          <h2 className="section-h2 text-white">Gotowy żeby inwestować mądrzej?</h2>
          <p className="landing-body mt-4 text-white/90">
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
            <Link to="/" className="inline-flex" aria-label="StockAI Pro — strona główna">
              <img
                src="/logo.png"
                alt="StockAI Pro"
                className="h-10 w-auto max-w-[min(100%,300px)] object-contain object-left md:h-11 md:max-w-[340px]"
                decoding="async"
              />
            </Link>
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
