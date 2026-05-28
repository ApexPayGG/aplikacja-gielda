import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Bars3Icon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EtoroCTAButton } from "../components/EtoroCTAButton";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import { LandingAiBriefPreview } from "../components/landing/LandingAiBriefPreview";
import { LandingCompanySearchTeaser } from "../components/landing/LandingCompanySearchTeaser";
import { LandingComplianceBlock } from "../components/landing/LandingComplianceBlock";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { SEOHead } from "../components/SEOHead";
import { BrandLogo } from "../components/BrandLogo";
import { CountryFlag } from "../components/CountryFlag";
import { LANGUAGE_OPTIONS, resolveLanguageCode } from "../constants/languages";
import {
  annualSavingsPercent,
  formatEurPrice,
  PRICING_PLANS,
} from "../config/pricing";
import {
  TERMINAL_HERO_GRID,
  TERMINAL_HERO_PANEL,
  TERMINAL_INPUT,
  TERMINAL_LANDING_BG,
  TERMINAL_LANDING_CTA_PRIMARY,
  TERMINAL_LANDING_CTA_SECONDARY,
  TERMINAL_LANDING_EYEBROW,
  TERMINAL_NAV_SHELL,
  TERMINAL_PRICING_PREVIEW_CARD,
  TERMINAL_PROOF_CARD,
} from "../components/terminal/terminalStyles";

const ACCENT_CYAN = "#22d3ee";

const ETORO_AFFILIATE_URL =
  "https://med.etoro.com/B9219_A129734_TClick_Sstockaipro-main.aspx";

const LANDING_ICON_SRC = {
  solution: [
    "/icons/landing/solution-brief.png",
    "/icons/landing/solution-coach.png",
    "/icons/landing/solution-dna.png",
    "/icons/landing/solution-premortem.png",
    "/icons/landing/solution-globe.png",
    "/icons/landing/solution-paper.png",
  ],
  howItWorks: [
    "/icons/landing/how-step-1.png",
    "/icons/landing/how-step-2.png",
    "/icons/landing/how-step-3.png",
  ],
} as const;

function LandingFeatureIcon({ src, className = "" }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      width={28}
      height={28}
      className={["h-7 w-7 shrink-0 object-contain", className].filter(Boolean).join(" ")}
      loading="lazy"
      decoding="async"
      aria-hidden
    />
  );
}

const pricingTiers = [
  {
    id: "trial",
    nameKey: "landing.pricing.tiers.trial.name",
    bodyKey: "landing.pricing.tiers.trial.body",
    featuresKey: "landing.pricing.tiers.trial.features",
    ctaKey: "landing.pricing.tiers.trial.cta",
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
] as const;

function landingTierPrice(tierId: (typeof pricingTiers)[number]["id"], billingCycle: BillingCycle): string {
  if (tierId === "trial") return "€0";
  if (tierId === "pro") return formatEurPrice("PRO", billingCycle);
  return formatEurPrice("PRO_PLUS", billingCycle);
}

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

function SignalWave({
  offset = 0,
  opacity = 0.08,
  color = ACCENT_CYAN,
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
  const iconSrc = LANDING_ICON_SRC.howItWorks[stepIndex] ?? LANDING_ICON_SRC.howItWorks[0];

  const accentRing = [
    "shadow-[0_0_0_1px_rgba(6,182,212,0.35)]",
    "shadow-[0_0_0_1px_rgba(34,211,238,0.35)]",
    "shadow-[0_0_0_1px_rgba(34,211,238,0.45)]",
  ][stepIndex] ?? "shadow-[0_0_0_1px_rgba(255,255,255,0.12)]";

  const shell = [
    "landing-how-float relative flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-visible rounded-2xl",
    "border border-terminal-border bg-gradient-to-br from-terminal-panel to-terminal-panelSecondary",
    "shadow-terminal-panel",
    accentRing,
  ].join(" ");

  return (
    <div className={shell}>
      <img
        src={iconSrc}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 object-contain"
        loading="lazy"
        decoding="async"
        aria-hidden
      />
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
              <stop offset="0%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#22d3ee" />
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
    <svg viewBox="0 0 280 100" className="h-28 w-full animate-fadeInUp sm:h-36 md:h-40" aria-hidden preserveAspectRatio="xMidYMid meet">
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
        stroke="#22d3ee"
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
  const { t } = useTranslation("common");
  const cardShell = `${TERMINAL_PROOF_CARD} rounded-2xl px-3 py-2 md:px-4 md:py-3`;

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
          <span className="text-[11px] font-bold text-terminal-cyan">AAPL</span>
          <span className="text-[11px] font-semibold text-terminal-textSecondary">{t("landing.hero.contextNoteTitle")}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-terminal-textMuted">{t("landing.hero.contextNoteBody")}</div>
      </div>

      <div
        className={`animate-float absolute bottom-[7.25rem] right-2 z-20 origin-bottom-right scale-[0.78] sm:bottom-24 sm:right-1 sm:scale-90 md:-right-4 md:scale-100 ${cardShell}`}
        style={{
          animationDelay: "1.5s",
        }}
      >
        <div className="text-[11px] font-bold text-terminal-cyan">🧠 {t("landing.hero.coachAlertTitle")}</div>
        <div className="mt-0.5 text-[10px] text-terminal-textMuted">{t("landing.hero.coachAlertBody")}</div>
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
          <circle cx={node.x} cy={node.y} r={4} fill="#22d3ee" />
          <circle cx={node.x} cy={node.y} r={8} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.5} />
        </g>
      ))}
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22d3ee" strokeWidth={0.5} opacity={0.6} />
      ))}
      <circle r={3} fill="#22d3ee" opacity={0.8}>
        <animateMotion dur="3s" repeatCount="indefinite" path="M80,200 L200,80 L380,150 L420,320 L150,380 L80,200" />
      </circle>
      <circle r={2} fill="#FFAE33" opacity={0.6}>
        <animateMotion dur="4s" repeatCount="indefinite" begin="1s" path="M200,80 L300,280 L380,150 L80,200" />
      </circle>
    </svg>
  );
}

const WORLD_CLOCK_CITIES = [
  { name: "Warszawa", timezone: "Europe/Warsaw", exchange: "GPW", flag: "🇵🇱" },
  { name: "London", timezone: "Europe/London", exchange: "LSE", flag: "🇬🇧" },
  { name: "New York", timezone: "America/New_York", exchange: "NYSE", flag: "🇺🇸" },
  { name: "Frankfurt", timezone: "Europe/Berlin", exchange: "DAX", flag: "🇩🇪" },
  { name: "Tokyo", timezone: "Asia/Tokyo", exchange: "TSE", flag: "🇯🇵" },
  { name: "Hong Kong", timezone: "Asia/Hong_Kong", exchange: "HKEX", flag: "🇭🇰" },
] as const;

function getZonedTime(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  let hours = value("hour");
  if (hours === 24) hours = 0;

  return {
    hours,
    minutes: value("minute"),
    seconds: value("second"),
  };
}

function isExchangeOpenSimple(hour24: number) {
  return hour24 >= 9 && hour24 < 17;
}

function WorldClockFace({ timeZone, now }: { timeZone: string; now: Date }) {
  const { hours, minutes, seconds } = getZonedTime(timeZone, now);
  const hours12 = hours % 12;
  const hourDeg = hours12 * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6;
  const secondDeg = seconds * 6;
  const isOpen = isExchangeOpenSimple(hours);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <circle cx="50" cy="50" r="44" fill="rgba(255,255,255,0.03)" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x1 = 50 + 38 * Math.cos(angle);
        const y1 = 50 + 38 * Math.sin(angle);
        const x2 = 50 + 42 * Math.cos(angle);
        const y2 = 50 + 42 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={i % 3 === 0 ? 2 : 1}
          />
        );
      })}
      <line
        x1="50"
        y1="50"
        x2={50 + 24 * Math.sin((hourDeg * Math.PI) / 180)}
        y2={50 - 24 * Math.cos((hourDeg * Math.PI) / 180)}
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="50"
        x2={50 + 32 * Math.sin((minuteDeg * Math.PI) / 180)}
        y2={50 - 32 * Math.cos((minuteDeg * Math.PI) / 180)}
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="50"
        y1="50"
        x2={50 + 35 * Math.sin((secondDeg * Math.PI) / 180)}
        y2={50 - 35 * Math.cos((secondDeg * Math.PI) / 180)}
        stroke="#22d3ee"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="3" fill="#22d3ee" />
      <circle cx="50" cy="50" r="1.5" fill="white" />
      <circle cx="50" cy="18" r="3" fill={isOpen ? "#00A86B" : "#E53935"} opacity={0.9} />
    </svg>
  );
}

type HowItWorksStep = { title: string; desc: string };
type ProductTrustItem = { title: string; body: string };

function LandingFooterLanguages() {
  const { t, i18n } = useTranslation("common");
  const current = resolveLanguageCode(i18n.resolvedLanguage);

  const handleChange = async (code: string) => {
    await i18n.changeLanguage(code);
    localStorage.setItem("stockai.lang", code);
  };

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1 text-sm"
      aria-label={t("landing.footer.languagesAria")}
    >
      {LANGUAGE_OPTIONS.map((opt, index) => (
        <span key={opt.code} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-white/30" aria-hidden>|</span> : null}
          <button
            type="button"
            onClick={() => void handleChange(opt.code)}
            title={opt.label}
            aria-label={opt.label}
            aria-current={current === opt.code ? "true" : undefined}
            className={`inline-flex items-center rounded-md p-1.5 transition ${
              current === opt.code
                ? "bg-white/15 ring-1 ring-white/25"
                : "cursor-pointer opacity-70 hover:bg-white/5 hover:opacity-100"
            }`}
          >
            <CountryFlag
              countryCode={opt.countryCode}
              className="block h-5 w-7 min-h-[20px] min-w-[28px] rounded-[3px] object-cover shadow-sm"
              title={opt.label}
            />
          </button>
        </span>
      ))}
    </div>
  );
}

function WorldClocks() {
  const { t, i18n } = useTranslation("common");
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="world-clocks-section reveal relative overflow-hidden py-16"
      style={{
        background: "linear-gradient(135deg, #050914 0%, #0b1220 50%, #0a1628 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden>
        <GlobalConnectionsSVG />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="section-h2 mb-3 text-white">
            {t("landing.worldClocks.title")}
            <span className="text-terminal-cyan"> {t("landing.worldClocks.titleAccent")}</span>
          </h2>
          <p className="text-base text-white/60 sm:text-lg">{t("landing.worldClocks.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6">
          {WORLD_CLOCK_CITIES.map((city, i) => {
            const { hours } = getZonedTime(city.timezone, time);
            const isOpen = isExchangeOpenSimple(hours);
            const timeStr = time.toLocaleTimeString(i18n.language, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: city.timezone,
            });
            const staggerClass = i % 3 === 0 ? "stagger-1" : i % 3 === 1 ? "stagger-2" : "stagger-3";

            return (
              <div
                key={city.name}
                className={`world-clocks-city reveal flex flex-col items-center gap-3 ${staggerClass}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div
                  className="relative h-20 w-20 rounded-full p-1"
                  style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
                    border: `2px solid ${isOpen ? "rgba(0,168,107,0.4)" : "rgba(229,57,53,0.2)"}`,
                    boxShadow: isOpen ? "0 0 20px rgba(0,168,107,0.2)" : "none",
                  }}
                >
                  <WorldClockFace timeZone={city.timezone} now={time} />
                </div>

                <div className="text-center">
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <span className="text-sm">{city.flag}</span>
                    <span className="text-sm font-semibold text-white">{city.name}</span>
                  </div>
                  <div className="font-mono text-xs text-[#22d3ee]">{timeStr}</div>
                  <div className="text-xs text-white/40">{city.exchange}</div>
                  <div className="mt-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: isOpen ? "rgba(0,168,107,0.2)" : "rgba(229,57,53,0.15)",
                        color: isOpen ? "#00A86B" : "#E53935",
                        border: `1px solid ${isOpen ? "rgba(0,168,107,0.3)" : "rgba(229,57,53,0.2)"}`,
                      }}
                    >
                      {isOpen ? t("landing.worldClocks.open") : t("landing.worldClocks.closed")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type HeroVisualProps = {
  heroPrices: Record<HeroTicker, number>;
  heroPctByTicker: Partial<Record<HeroTicker, number>>;
  flashTicker: HeroTicker | null;
};

function HeroVisual({ heroPrices, heroPctByTicker, flashTicker }: HeroVisualProps) {
  const { t } = useTranslation("common");

  return (
    <div className="landing-hero-dashboard relative min-h-[280px] w-full sm:min-h-[360px] md:min-h-[480px] lg:min-h-[520px]">
      <GlobalConnectionsSVG />

      <div className="absolute inset-0 z-[1] flex items-end justify-center opacity-20">
        <CandlestickChart />
      </div>

      <div className="hero-card-glow absolute inset-x-2 top-4 z-10 rounded-2xl sm:inset-x-4 sm:top-6 md:inset-x-8 md:top-8">
        <div className={`hero-card-glow-inner ${TERMINAL_HERO_PANEL} relative overflow-hidden rounded-[14px]`}>
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-white">{t("landing.hero.widgetTitle")}</h2>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                {t("landing.hero.widgetLive")}
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
                    className={`${TERMINAL_HERO_GRID} transition-all duration-500 ${
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

const SOLUTION_CARD_KEYS: { titleKey: string; bodyKey: string }[] = [
  { titleKey: "landing.solution.features.aiBrief.title", bodyKey: "landing.solution.features.aiBrief.body" },
  { titleKey: "landing.solution.features.behavioralCoach.title", bodyKey: "landing.solution.features.behavioralCoach.body" },
  { titleKey: "landing.solution.features.signalDna.title", bodyKey: "landing.solution.features.signalDna.body" },
  { titleKey: "landing.solution.features.preMortemAi.title", bodyKey: "landing.solution.features.preMortemAi.body" },
  { titleKey: "landing.solution.features.globalMarkets.title", bodyKey: "landing.solution.features.globalMarkets.body" },
  { titleKey: "landing.solution.features.paperTrading.title", bodyKey: "landing.solution.features.paperTrading.body" },
];

const PROBLEM_CARD_KEYS = ["apps", "emotions", "context"] as const;

export function LandingPage() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState("");

  const [heroPrices, setHeroPrices] = useState<Record<HeroTicker, number>>(() => ({ ...INITIAL_HERO_PRICES }));
  const [heroPctByTicker, setHeroPctByTicker] = useState<Partial<Record<HeroTicker, number>>>({});
  const [flashTicker, setFlashTicker] = useState<HeroTicker | null>(null);

  const exchangesCounter = useCounter(130);
  const modulesCounter = useCounter(27);
  const langsCounter = useCounter(9);

  const solutionCards = useMemo(
    () =>
      SOLUTION_CARD_KEYS.map((card) => ({
        title: t(card.titleKey),
        body: t(card.bodyKey),
      })),
    [t, i18n.language],
  );

  const marqueeItems = useMemo(
    () => [
      t("landing.socialProof.stats.exchanges"),
      t("landing.socialProof.stats.modules"),
      t("landing.socialProof.stats.languages"),
      t("landing.socialProof.stats.adFree"),
      t("landing.socialProof.marqueeMarkets"),
    ],
    [t, i18n.language],
  );

  const howItWorksSteps = useMemo((): HowItWorksStep[] => {
    const translated = t("landing.howItWorks.steps", { returnObjects: true });
    if (Array.isArray(translated)) {
      return translated.filter(
        (item): item is HowItWorksStep =>
          typeof item === "object" &&
          item !== null &&
          "title" in item &&
          "desc" in item &&
          typeof (item as HowItWorksStep).title === "string" &&
          typeof (item as HowItWorksStep).desc === "string",
      );
    }
    return [];
  }, [t, i18n.language]);

  const productTrustItems = useMemo((): ProductTrustItem[] => {
    const translated = t("landing.productTrust.items", { returnObjects: true });
    if (Array.isArray(translated)) {
      return translated.filter(
        (item): item is ProductTrustItem =>
          typeof item === "object" &&
          item !== null &&
          "title" in item &&
          "body" in item &&
          typeof (item as ProductTrustItem).title === "string" &&
          typeof (item as ProductTrustItem).body === "string",
      );
    }
    return [];
  }, [t, i18n.language]);

  useEffect(() => {
    document.title = t("landing.seo.title");
  }, [t, i18n.language]);

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

  const marqueeTrack = [...marqueeItems, ...marqueeItems];
  const tickerMarqueeTrack = [...TICKER_BAR_ITEMS, ...TICKER_BAR_ITEMS];

  const goToCompaniesSearch = (query = navSearchQuery): void => {
    const q = query.trim();
    navigate(q ? `/companies?q=${encodeURIComponent(q)}` : "/companies");
  };

  return (
    <div className={TERMINAL_LANDING_BG}>
      <SEOHead title={t("landing.seo.title")} description={t("landing.seo.description")} ogType="website" />

      {/* ═══ TICKER BAR (demo quotes) ═══ */}
      <div
        className="h-10 overflow-hidden bg-[#0A0A0F]"
        aria-label={t("landingAria.demoTickerTape", { defaultValue: "Sample market listings — demo data" })}
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
        className={`${TERMINAL_NAV_SHELL} relative transition-shadow duration-300 ${navScrolled ? "shadow-terminal-glow" : ""}`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 md:gap-6 md:py-5">
          <Link to="/" className="flex min-w-0 shrink-0 items-center py-1" aria-label={t("landingAria.homeLogo", { defaultValue: "Stock-AI.Pro — home" })}>
            <BrandLogo size="nav" />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-10 text-sm font-semibold text-terminal-textSecondary md:flex">
            <a href="#how-it-works" className="transition hover:text-terminal-cyan">
              {t("landing.nav.howItWorks")}
            </a>
            <a href="#solution" className="transition hover:text-terminal-cyan">
              {t("landing.nav.features")}
            </a>
            <a href="#pricing" className="transition hover:text-terminal-cyan">
              {t("landing.nav.pricing")}
            </a>
            <Link to="/companies" className="transition hover:text-terminal-cyan">
              {t("landing.nav.markets")}
            </Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <form
              className="relative hidden md:block"
              onSubmit={(e) => {
                e.preventDefault();
                goToCompaniesSearch();
              }}
            >
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-terminal-cyan/50"
                aria-hidden
              />
              <input
                type="search"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                onFocus={() => goToCompaniesSearch()}
                onClick={() => goToCompaniesSearch()}
                placeholder={t("landing.nav.searchPlaceholder")}
                aria-label={t("landing.nav.searchPlaceholder")}
                className={`${TERMINAL_INPUT} w-48 rounded-full py-1.5 pl-9 pr-4 transition-all duration-300 focus:w-64`}
              />
            </form>
            <LanguageSwitcher variant="landing" />
            <Link to="/login" className={`hidden min-h-11 sm:inline-flex ${TERMINAL_LANDING_CTA_SECONDARY} px-4 py-2 text-sm`}>
              {t("auth.loginButton")}
            </Link>
            <Link
              to="/register"
              className={`hidden min-h-11 sm:inline-flex md:px-6 ${TERMINAL_LANDING_CTA_PRIMARY} px-4 py-2.5 text-sm`}
            >
              {t("landing.hero.ctaPrimary")}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-terminal-borderMuted text-terminal-cyan transition hover:border-terminal-cyan/40 hover:bg-terminal-panelSecondary md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              aria-label={
                mobileNavOpen
                  ? t("landingAria.closeMenu", { defaultValue: "Close menu" })
                  : t("landingAria.openMenu", { defaultValue: "Open menu" })
              }
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <nav
            id="landing-mobile-nav"
            className="border-t border-terminal-border bg-terminal-panel px-4 py-4 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {(
                [
                  { href: "#how-it-works", label: t("landing.nav.howItWorks") },
                  { href: "#solution", label: t("landing.nav.features") },
                  { href: "#pricing", label: t("landing.nav.pricing") },
                  { href: "/companies", label: t("landing.nav.markets") },
                ] satisfies { href: string; label: string }[]
              ).map((item) =>
                item.href.startsWith("/") ? (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="min-h-12 rounded-xl px-3 py-3 text-base font-semibold text-terminal-cyan transition hover:bg-terminal-panelSecondary"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    className="min-h-12 rounded-xl px-3 py-3 text-base font-semibold text-terminal-cyan transition hover:bg-terminal-panelSecondary"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {item.label}
                  </a>
                ),
              )}
            </div>
            <form
              className="relative mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                goToCompaniesSearch();
                setMobileNavOpen(false);
              }}
            >
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-terminal-cyan/50"
                aria-hidden
              />
              <input
                type="search"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder={t("landing.nav.searchPlaceholder")}
                aria-label={t("landing.nav.searchPlaceholder")}
                className={`${TERMINAL_INPUT} w-full rounded-xl py-3 pl-10 pr-4 text-base`}
              />
            </form>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className={`min-h-12 ${TERMINAL_LANDING_CTA_SECONDARY} text-sm`}
                onClick={() => setMobileNavOpen(false)}
              >
                {t("auth.loginButton")}
              </Link>
              <Link
                to="/register"
                className={`min-h-12 ${TERMINAL_LANDING_CTA_PRIMARY} text-sm`}
                onClick={() => setMobileNavOpen(false)}
              >
                {t("landing.hero.ctaPrimary")}
              </Link>
            </div>
          </nav>
        ) : null}
        {navScrolled ? (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, #22d3ee 30%, #0891b2 70%, transparent)",
            }}
            aria-hidden
          />
        ) : null}
      </header>

      {/* ═══ HERO ═══ */}
      <section className="hero-gradient-bg relative isolate flex min-h-[min(100dvh,920px)] items-start overflow-x-hidden pt-20 pb-12 md:min-h-screen">
        <div
          className="pointer-events-none absolute left-4 top-8 z-0 h-40 w-40 rounded-full opacity-20 blur-3xl sm:left-10 sm:top-10 sm:h-56 sm:w-56 md:h-72 md:w-72"
          style={{ background: "radial-gradient(circle, #0891b2, transparent)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-1/2 z-0 h-48 w-48 -translate-y-1/2 rounded-full opacity-15 blur-3xl sm:h-64 sm:w-64 md:h-80 md:w-80"
          style={{ background: "radial-gradient(circle, #22d3ee, transparent)" }}
          aria-hidden
        />
        <SignalWave offset={320} opacity={0.14} />
        <SignalWave offset={460} opacity={0.09} color="#0891b2" />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-4 lg:grid-cols-[3fr_2fr] lg:gap-12">
          {/* Left column */}
          <div className="flex flex-col justify-center">
            <span className={`landing-hero-badge mb-6 ${TERMINAL_LANDING_EYEBROW}`}>{t("landing.hero.badge")}</span>

            <h1 className="hero-h1 text-terminal-text">
              <span className="landing-hero-h1-line1 block">{t("landing.hero.titleLine1")}</span>
              <span className="landing-hero-h1-line2 mt-1 block text-terminal-cyan">{t("landing.hero.titleLine2")}</span>
            </h1>

            <p className="landing-hero-sub landing-body mt-6 max-w-lg text-terminal-textSecondary">
              {t("landing.hero.subtitle")}
            </p>

            <div className="landing-hero-cta mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link to="/register" className={TERMINAL_LANDING_CTA_PRIMARY}>
                {t("landing.hero.ctaPrimary")} →
              </Link>
              <a href="#pricing" className={TERMINAL_LANDING_CTA_SECONDARY}>
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>

            <p className="landing-hero-trust mt-8 max-w-lg text-sm font-medium leading-relaxed text-terminal-textMuted sm:mt-10">
              {t("landing.heroSocialProof")}
            </p>
          </div>

          {/* Right column — Hero visual */}
          <div className="flex flex-col justify-center">
            <HeroVisual heroPrices={heroPrices} heroPctByTicker={heroPctByTicker} flashTicker={flashTicker} />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-gray-400">{t("landing.hero.scrollHint")}</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF MARQUEE (flush under hero, zero vertical gap) ═══ */}
      <section className="mt-0 overflow-hidden border-y border-terminal-border bg-terminal-panel py-4">
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap px-4 text-sm font-semibold text-terminal-text md:text-base">
          {marqueeTrack.map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex items-center gap-8">
              <span>{item}</span>
              <span className="text-terminal-cyan" aria-hidden>
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
          background: "linear-gradient(135deg, #0b1220 0%, #050914 50%, #0a1628 100%)",
        }}
      >
        <SignalWave offset={-36} opacity={0.1} color="#67e8f9" />
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-white/10 md:grid-cols-4 md:divide-y-0">
          <div ref={exchangesCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{exchangesCounter.count}+</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">{t("landing.stats.exchanges")}</p>
          </div>
          <div ref={modulesCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{modulesCounter.count}</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">{t("landing.stats.modules")}</p>
          </div>
          <div ref={langsCounter.ref} className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <div className="text-5xl font-black tabular-nums text-white md:text-6xl">{langsCounter.count}</div>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-white/60">{t("landing.stats.languages")}</p>
          </div>
          <div className="flex flex-col items-center px-4 py-8 text-center md:py-10">
            <div className="text-3xl font-black text-white md:text-4xl">{t("landing.stats.investors")}</div>
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section
        id="problem"
        className="relative scroll-mt-24 overflow-hidden px-4 py-20"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgb(34 211 238 / 0.04) 100%)" }}
      >
        <SignalWave offset={-40} opacity={0.12} />
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
            style={{
              width: "800px",
              height: "400px",
              background: "radial-gradient(ellipse, rgba(34,211,238,0.06) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-white">{t("landing.problem.title")}</h2>
          <p className="landing-body mt-4 text-[#94a3b8]">{t("landing.problem.subtitle")}</p>
        </div>

        <div className="relative z-10 mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
          {PROBLEM_CARD_KEYS.map((cardKey, index) => {
            const staggerClass = index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
            const title = t(`landing.problem.cards.${cardKey}.title`);
            const body = t(`landing.problem.cards.${cardKey}.body`);
            return (
              <article
                key={cardKey}
                className={`${TERMINAL_PROOF_CARD} reveal group relative overflow-hidden border-l-4 border-l-terminal-cyan py-8 pl-6 pr-8 transition-all duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 ${staggerClass}`}
              >
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="landing-body mt-3 text-[#94a3b8]">{body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ SOLUTION ═══ */}
      <section
        id="solution"
        className="relative scroll-mt-24 overflow-hidden px-4 py-20"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgb(34 211 238 / 0.06) 50%, transparent 100%)" }}
      >
        <SignalWave offset={20} opacity={0.1} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-white">
            {t("landing.solution.title")}
            <br />
            <span className="text-terminal-cyan">{t("landing.solution.titleAccent")}</span>
          </h2>
          <p className="landing-body mt-4 text-[#94a3b8]">{t("landing.solution.subtitle")}</p>
        </div>

        <div className="relative z-10 mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutionCards.map((card, index) => {
            const revealKind =
              index % 3 === 0 ? "reveal-left" : index % 3 === 2 ? "reveal-right" : "reveal";
            const staggerClass =
              index % 3 === 0 ? "stagger-1" : index % 3 === 1 ? "stagger-2" : "stagger-3";
            const iconSrc = LANDING_ICON_SRC.solution[index] ?? LANDING_ICON_SRC.solution[0];
            return (
              <article
                key={card.title}
                className={`${TERMINAL_PROOF_CARD} ${revealKind} group relative overflow-hidden border-t-[3px] border-t-terminal-cyan p-6 pt-12 transition-all duration-300 hover:-translate-y-1 ${staggerClass}`}
              >
                <LandingFeatureIcon src={iconSrc} className="absolute left-4 top-4 z-[2]" />
                <span className="pointer-events-none absolute right-4 top-4 text-6xl font-black leading-none text-terminal-cyan/[0.12]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="relative z-[1] text-lg font-bold text-white">{card.title}</h3>
                <p className="landing-body relative z-[1] mt-2 text-[#94a3b8]">{card.body}</p>
              </article>
            );
          })}
        </div>

        <div className="relative z-10 mx-auto mt-14 max-w-3xl px-4">
          <LandingComplianceBlock />
        </div>
      </section>

      <LandingCompanySearchTeaser />

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden px-4 py-20">
        <SignalWave offset={-24} opacity={0.1} />
        <h2 className="section-h2 relative z-10 text-center text-white">{t("landing.howItWorks.title")}</h2>

        <div className="relative z-10 mx-auto mt-16 md:hidden">
          <div className="mx-auto grid max-w-lg gap-12">
            {howItWorksSteps.map((item, index) => {
              const staggerClass =
                index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
              return (
                <div key={`${item.title}-${index}`} className={`group reveal flex flex-col items-center text-center ${staggerClass}`}>
                  <div className="transition-transform duration-300 group-hover:-translate-y-2">
                    <HowItWorksStepBadge stepIndex={index} />
                  </div>
                  <h3 className="mt-8 text-lg font-bold text-white">{item.title}</h3>
                  <p className="landing-body mt-2 text-[#94a3b8]">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-16 hidden max-w-5xl md:block">
          <div className="flex items-start justify-between gap-2 px-2">
            {howItWorksSteps.map((item, index) => {
              const staggerClass =
                index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
              const connector =
                index < howItWorksSteps.length - 1 ? (
                  <div className="flex min-h-[92px] min-w-0 flex-[1] items-center px-2">
                    <div
                      className="timeline-line h-[2px] w-full rounded-full"
                      style={{
                        background:
                          index === 0
                            ? "linear-gradient(90deg, #0891b2, #22d3ee)"
                            : "linear-gradient(90deg, #22d3ee, #0891b2)",
                      }}
                    />
                  </div>
                ) : null;

              return (
                <div key={`${item.title}-${index}`} className="contents">
                  <div
                    className={`group reveal flex min-w-0 max-w-[30%] flex-[1.15] flex-col items-center text-center ${staggerClass}`}
                  >
                    <div className="transition-transform duration-300 group-hover:-translate-y-2">
                      <HowItWorksStepBadge stepIndex={index} />
                    </div>
                    <h3 className="mt-8 text-lg font-bold text-white">{item.title}</h3>
                    <p className="landing-body mt-2 text-[#94a3b8]">{item.desc}</p>
                  </div>
                  {connector}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <LandingAiBriefPreview />

      <WorldClocks />

      {/* ═══ ETORO PARTNER ═══ */}
      <section className="border-y border-white/10 px-4 py-20">
        <div className={`${TERMINAL_PROOF_CARD} mx-auto max-w-xl p-8`}>
          <p className="text-center text-sm font-semibold text-white/90">{t("etoro.subtitle")}</p>
          <EtoroCTAButton sourcePage="landing_page" className="mx-auto mt-4 max-w-sm" />
        </div>
      </section>

      {/* ═══ PRODUCT TRUST (no testimonials) ═══ */}
      <section className="relative overflow-hidden px-4 py-20">
        <SignalWave offset={60} opacity={0.1} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="section-h2 text-white">{t("landing.productTrust.title")}</h2>
          <p className="landing-body mt-4 text-[#94a3b8]">{t("landing.productTrust.subtitle")}</p>
        </div>
        <div className="relative z-10 mx-auto mt-14 grid max-w-6xl gap-8 md:grid-cols-3">
          {productTrustItems.map((item, index) => {
            const staggerClass = index === 0 ? "stagger-1" : index === 1 ? "stagger-2" : "stagger-3";
            return (
              <article
                key={`${item.title}-${index}`}
                className={`${TERMINAL_PROOF_CARD} reveal border-t-[3px] border-t-terminal-cyan p-8 ${staggerClass}`}
              >
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="landing-body mt-3 text-[#94a3b8]">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="relative scroll-mt-24 overflow-hidden px-4 py-20">
        <SignalWave offset={-20} opacity={0.09} />
        <div className="relative z-10 mx-auto max-w-6xl">
          <h2 className="section-h2 text-center text-white">{t("landing.pricing.title")}</h2>

          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-full border border-terminal-border bg-terminal-panelSecondary p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                  billingCycle === "monthly"
                    ? "bg-terminal-cyan text-terminal-buttonText shadow-md"
                    : "text-terminal-textMuted hover:text-terminal-text"
                }`}
              >
                {t("landing.pricing.monthly")}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                  billingCycle === "yearly"
                    ? "bg-terminal-cyan text-terminal-buttonText shadow-md"
                    : "text-terminal-textMuted hover:text-terminal-text"
                }`}
              >
                {t("landing.pricing.yearly")}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm font-medium text-[#94a3b8]">
            {t("landing.pricing.betaNote", {
              defaultValue:
                "EUR checkout migration in progress. Join the beta waitlist for trial access while Stripe EUR prices are configured.",
            })}
          </p>

          <div className="mx-auto mt-10 max-w-3xl">
            <LandingComplianceBlock />
          </div>

          <div className="mt-10 grid grid-cols-1 items-stretch gap-6 sm:mt-14 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 lg:items-center">
            {pricingTiers.map((tier) => {
              const isPro = tier.id === "pro";
              const isTrial = tier.id === "trial";
              const isProPlus = tier.id === "proPlus";
              const priceDisplay = landingTierPrice(tier.id, billingCycle);

              if (isPro) {
                return (
                  <article
                    key={tier.id}
                    className="relative z-10 order-first rounded-2xl border border-terminal-cyan/40 p-6 text-terminal-text shadow-terminal-glow sm:p-8 lg:order-none lg:scale-105"
                    style={{
                      background: "linear-gradient(135deg, #0891b2 0%, #0e7490 55%, #0b1220 100%)",
                    }}
                  >
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
                      style={{ background: "#22d3ee", color: "#0A0A0F" }}
                    >
                      {t("landing.pricing.popular")}
                    </span>
                    <h3 className="mt-4 text-xl font-bold">{t(tier.nameKey)}</h3>
                    <p className="mt-6 text-5xl font-bold">{priceDisplay}</p>
                    {billingCycle === "yearly" ? (
                      <p className="mt-2 text-sm font-semibold text-emerald-300">
                        {t("landing.pricing.save", {
                          defaultValue: `Save ~${annualSavingsPercent("PRO")}%`,
                        })}
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
                    <Link
                      to="/waitlist?source=landing"
                      className="mt-8 inline-flex w-full justify-center rounded-full bg-terminal-cyan py-3 text-center text-sm font-bold text-terminal-buttonText transition hover:bg-terminal-cyanStrong"
                    >
                      {t(tier.ctaKey, { defaultValue: "Join beta" })}
                    </Link>
                  </article>
                );
              }

              return (
                <article
                  key={tier.id}
                  className={`${TERMINAL_PRICING_PREVIEW_CARD} p-8 ${isProPlus ? "border-2 border-terminal-cyan/50" : ""}`}
                >
                  <h3 className="text-xl font-bold text-terminal-text">{t(tier.nameKey)}</h3>
                  <p className={`mt-6 font-bold text-terminal-cyan ${isTrial ? "text-4xl" : "text-4xl"}`}>
                    {priceDisplay}
                  </p>
                  {isTrial ? (
                    <p className="mt-2 text-sm text-[#94a3b8]">
                      {t("landing.pricing.tiers.trial.duration", { defaultValue: "7 days" })}
                    </p>
                  ) : null}
                  {tier.id === "proPlus" && billingCycle === "yearly" ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-600">
                      {t("landing.pricing.saveProPlus", {
                        defaultValue: `Save ~${annualSavingsPercent("PRO_PLUS")}%`,
                      })}
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm text-[#94a3b8]">{t(tier.bodyKey)}</p>
                  <ul className="mt-6 space-y-2 text-sm text-white/85">
                    {pricingFeatures(tier.featuresKey).map((item) => (
                      <li key={item} className="flex gap-2">
                        <PricingFeatureCheck accent="cyan" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {isTrial ? (
                    <Link
                      to="/register"
                      className="mt-8 inline-flex w-full justify-center rounded-full border border-white/15 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {t(tier.ctaKey, { defaultValue: "Start trial" })}
                    </Link>
                  ) : (
                    <Link
                      to="/waitlist?source=landing"
                      className={`mt-8 inline-flex w-full justify-center rounded-full border-2 border-terminal-cyan py-3 text-sm font-bold text-terminal-cyan transition hover:bg-terminal-cyan/10`}
                    >
                      {t(tier.ctaKey, { defaultValue: "Join beta" })}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <article className={`${TERMINAL_PRICING_PREVIEW_CARD} mx-auto mt-10 max-w-2xl text-center`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-terminal-cyan">
              {t("landing.pricing.tiers.investorOs.comingSoon", { defaultValue: "Coming soon" })}
            </p>
            <h3 className="mt-3 text-xl font-bold text-white">
              {t("landing.pricing.tiers.investorOs.name", { defaultValue: PRICING_PLANS.INVESTOR_OS.displayName })}
            </h3>
            <p className="mt-3 text-3xl font-bold text-terminal-cyan">
              {formatEurPrice("INVESTOR_OS", billingCycle)}
            </p>
            <p className="mt-4 text-sm text-[#94a3b8]">
              {t("landing.pricing.tiers.investorOs.body", { defaultValue: PRICING_PLANS.INVESTOR_OS.tagline })}
            </p>
          </article>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section
        className="relative overflow-hidden border-y border-terminal-border bg-gradient-to-br from-terminal-panel via-[#0b1220] to-terminal-bg px-4 py-20 text-center text-terminal-text"
      >
        <ParticleDots />
        <div className="relative z-10 mx-auto max-w-3xl">
          <h2 className="section-h2 text-terminal-text">{t("landing.footerCta.title")}</h2>
          <p className="landing-body mt-4 text-terminal-textSecondary">{t("landing.footerCta.disclaimer")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/register" className={TERMINAL_LANDING_CTA_PRIMARY}>
              {t("landing.footerCta.button")} →
            </Link>
            <a href="#pricing" className={TERMINAL_LANDING_CTA_SECONDARY}>
              {t("landing.footerCta.pricing")}
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-terminal-border bg-terminal-panel px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <InvestmentDisclaimer variant="landing" />
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-terminal-border bg-terminal-bg text-terminal-text">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex" aria-label={t("landingAria.homeLogo", { defaultValue: "Stock-AI.Pro — home" })}>
              <BrandLogo size="footer" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-terminal-textMuted">
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-terminal-text">{t("landing.footer.product")}</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/companies" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.productMarkets")}
                </Link>
              </li>
              <li>
                <Link to="/signals" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.productSignals")}
                </Link>
              </li>
              <li>
                <a href="#pricing" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.productPricing")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-terminal-text">{t("landing.footer.company")}</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#solution" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.solutionLink")}
                </a>
              </li>
              <li>
                <a
                  href={ETORO_AFFILIATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-textMuted transition hover:text-terminal-text"
                >
                  {t("landing.footer.legalEtoro")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-terminal-text">{t("landing.footer.legal")}</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-terminal-textMuted transition hover:text-terminal-text">
                  {t("landing.footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-terminal-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-terminal-textMuted md:flex-row">
            <p>{t("landing.footer.copyright")}</p>
            <LandingFooterLanguages />
          </div>
        </div>
      </footer>
    </div>
  );
}
