import type { ComponentType, SVGProps } from "react";
import {
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BellAlertIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  DocumentChartBarIcon,
  HomeIcon,
  NewspaperIcon,
  PresentationChartLineIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export type TerminalNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type TerminalNavItem = {
  id: string;
  labelKey: string;
  to?: string;
  enabled: boolean;
  icon: TerminalNavIcon;
  /** Path prefixes that mark this item active */
  matchPaths: string[];
};

export const PUBLIC_SHELL_PATHS = [
  "/",
  "/pricing",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/contact",
  "/about",
  "/waitlist",
  "/changelog",
  "/help",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/payment-success",
  "/payment-cancel",
  "/404",
  "/error",
] as const;

export function isPublicShellRoute(pathname: string): boolean {
  return PUBLIC_SHELL_PATHS.includes(pathname as (typeof PUBLIC_SHELL_PATHS)[number]);
}

export function isTerminalNavActive(pathname: string, item: TerminalNavItem): boolean {
  return item.matchPaths.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Active, wired modules — main sidebar */
export const TERMINAL_MAIN_NAV: TerminalNavItem[] = [
  {
    id: "dashboard",
    labelKey: "terminalNav.dashboard",
    to: "/dashboard",
    enabled: true,
    icon: HomeIcon,
    matchPaths: ["/dashboard"],
  },
  {
    id: "companies",
    labelKey: "terminalNav.companies",
    to: "/companies",
    enabled: true,
    icon: ChartBarSquareIcon,
    matchPaths: ["/companies", "/company"],
  },
  {
    id: "stock-analysis",
    labelKey: "terminalNav.stockAnalysis",
    to: "/companies",
    enabled: true,
    icon: SparklesIcon,
    matchPaths: ["/company"],
  },
  {
    id: "market-intel",
    labelKey: "terminalNav.marketIntel",
    to: "/digest",
    enabled: true,
    icon: PresentationChartLineIcon,
    matchPaths: ["/digest", "/crowd-wisdom"],
  },
  {
    id: "news-sentiment",
    labelKey: "terminalNav.newsSentiment",
    to: "/news-halflife",
    enabled: true,
    icon: NewspaperIcon,
    matchPaths: ["/news-halflife"],
  },
  {
    id: "signals",
    labelKey: "terminalNav.alertsSignals",
    to: "/signals",
    enabled: true,
    icon: BellAlertIcon,
    matchPaths: ["/signals"],
  },
  {
    id: "earnings",
    labelKey: "terminalNav.earningsHub",
    to: "/earnings-predictor",
    enabled: true,
    icon: CalendarDaysIcon,
    matchPaths: ["/earnings-predictor"],
  },
  {
    id: "dividend-hub",
    labelKey: "terminalNav.dividendHub",
    to: "/dividend",
    enabled: true,
    icon: BanknotesIcon,
    matchPaths: ["/dividend"],
  },
  {
    id: "insider",
    labelKey: "terminalNav.insider13f",
    to: "/insider-mirror",
    enabled: true,
    icon: UserCircleIcon,
    matchPaths: ["/insider-mirror"],
  },
  {
    id: "economic-calendar",
    labelKey: "terminalNav.economicCalendar",
    to: "/alpha-calendar",
    enabled: true,
    icon: CalendarDaysIcon,
    matchPaths: ["/alpha-calendar", "/alpha"],
  },
  {
    id: "portfolio",
    labelKey: "terminalNav.portfolio",
    to: "/paper-trading",
    enabled: true,
    icon: BriefcaseIcon,
    matchPaths: ["/paper-trading", "/mirror-trading"],
  },
  {
    id: "risk-lab",
    labelKey: "terminalNav.riskLab",
    to: "/stress-test",
    enabled: true,
    icon: ShieldExclamationIcon,
    matchPaths: ["/stress-test", "/concentration", "/premortem"],
  },
  {
    id: "strategy-lab",
    labelKey: "terminalNav.strategyLab",
    to: "/strategy-dna",
    enabled: true,
    icon: WrenchScrewdriverIcon,
    matchPaths: ["/strategy-dna", "/backtest", "/replay", "/reverse-screener"],
  },
  {
    id: "watchlists",
    labelKey: "terminalNav.watchlists",
    to: "/companies",
    enabled: true,
    icon: ArrowTrendingUpIcon,
    matchPaths: ["/companies"],
  },
  {
    id: "psyche-coach",
    labelKey: "terminalNav.psycheCoach",
    to: "/behavioral-coach",
    enabled: true,
    icon: SparklesIcon,
    matchPaths: ["/behavioral-coach", "/coach", "/psyche-profile", "/loss-streak"],
  },
  {
    id: "journal",
    labelKey: "terminalNav.journal",
    to: "/weekly-review",
    enabled: true,
    icon: DocumentChartBarIcon,
    matchPaths: ["/weekly-review", "/mistake-library"],
  },
  {
    id: "trade-brokers",
    labelKey: "terminalNav.tradeBrokers",
    to: "/alpaca",
    enabled: true,
    icon: BriefcaseIcon,
    matchPaths: ["/alpaca", "/autopilot"],
  },
  {
    id: "academy",
    labelKey: "terminalNav.academy",
    to: "/skill-tree",
    enabled: true,
    icon: AcademicCapIcon,
    matchPaths: ["/skill-tree", "/glossary"],
  },
  {
    id: "tax-center",
    labelKey: "terminalNav.taxCenter",
    to: "/tax-optimizer",
    enabled: true,
    icon: DocumentChartBarIcon,
    matchPaths: ["/tax-optimizer", "/position-size"],
  },
  {
    id: "reports",
    labelKey: "terminalNav.reports",
    to: "/track-record",
    enabled: true,
    icon: DocumentChartBarIcon,
    matchPaths: ["/track-record"],
  },
];

/** Footer/system links in sidebar */
export const TERMINAL_SYSTEM_NAV: TerminalNavItem[] = [
  {
    id: "settings",
    labelKey: "terminalNav.settings",
    to: "/settings",
    enabled: true,
    icon: Cog6ToothIcon,
    matchPaths: ["/settings", "/profile"],
  },
  {
    id: "billing",
    labelKey: "terminalNav.billing",
    to: "/pricing",
    enabled: true,
    icon: CreditCardIcon,
    matchPaths: ["/pricing"],
  },
];

/** Not wired yet — shown in Coming soon section only */
export const TERMINAL_COMING_SOON_NAV: TerminalNavItem[] = [
  {
    id: "options-flow",
    labelKey: "terminalNav.optionsFlow",
    enabled: false,
    icon: ArrowTrendingUpIcon,
    matchPaths: [],
  },
  {
    id: "dark-pool",
    labelKey: "terminalNav.darkPool",
    enabled: false,
    icon: ChartBarSquareIcon,
    matchPaths: [],
  },
  {
    id: "fixed-income",
    labelKey: "terminalNav.fixedIncome",
    enabled: false,
    icon: DocumentChartBarIcon,
    matchPaths: [],
  },
  {
    id: "fx-desk",
    labelKey: "terminalNav.fxDesk",
    enabled: false,
    icon: ArrowTrendingUpIcon,
    matchPaths: [],
  },
  {
    id: "commodities",
    labelKey: "terminalNav.commodities",
    enabled: false,
    icon: BriefcaseIcon,
    matchPaths: [],
  },
  {
    id: "crypto-bridge",
    labelKey: "terminalNav.cryptoBridge",
    enabled: false,
    icon: SparklesIcon,
    matchPaths: [],
  },
  {
    id: "alt-data",
    labelKey: "terminalNav.altData",
    enabled: false,
    icon: PresentationChartLineIcon,
    matchPaths: [],
  },
  {
    id: "ma-radar",
    labelKey: "terminalNav.maRadar",
    enabled: false,
    icon: BellAlertIcon,
    matchPaths: [],
  },
  {
    id: "ipo-calendar",
    labelKey: "terminalNav.ipoCalendar",
    enabled: false,
    icon: CalendarDaysIcon,
    matchPaths: [],
  },
  {
    id: "esg-lens",
    labelKey: "terminalNav.esgLens",
    enabled: false,
    icon: ShieldExclamationIcon,
    matchPaths: [],
  },
];

export const TERMINAL_ACTIVE_NAV = TERMINAL_MAIN_NAV.filter((item) => item.enabled && item.to);
export const TERMINAL_SOON_NAV = TERMINAL_COMING_SOON_NAV.filter((item) => !item.enabled);
