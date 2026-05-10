import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bars3Icon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import LanguageSwitcher from "./LanguageSwitcher";

type DropdownId = "markets" | "portfolio" | "tools";

const marketsLinks: { to: string; labelKey: string }[] = [
  { to: "/signals", labelKey: "nav.signals" },
  { to: "/dividend", labelKey: "nav.dividend" },
  { to: "/dividend/intelligence", labelKey: "nav.dividendIntelligence" },
  { to: "/alpha", labelKey: "nav.alphaCalendar" },
];

const portfolioLinks: { to: string; labelKey: string }[] = [
  { to: "/paper-trading", labelKey: "nav.paperTrading" },
  { to: "/mirror-trading", labelKey: "nav.mirrorTrading" },
  { to: "/coach", labelKey: "nav.coach" },
  { to: "/mistake-library", labelKey: "nav.mistakeLibrary" },
  { to: "/psyche-profile", labelKey: "nav.psycheProfile" },
  { to: "/stress-test", labelKey: "nav.stressTest" },
  { to: "/concentration", labelKey: "nav.concentration" },
];

const toolsLinks: { to: string; labelKey: string }[] = [
  { to: "/position-size", labelKey: "nav.positionSize" },
  { to: "/premortem", labelKey: "nav.premortem" },
  { to: "/correlation", labelKey: "nav.correlation" },
  { to: "/volatility", labelKey: "nav.volatility" },
  { to: "/crowd-wisdom", labelKey: "nav.crowdWisdom" },
  { to: "/dividend-compound", labelKey: "nav.dividendCompound" },
  { to: "/glossary", labelKey: "nav.glossary" },
  { to: "/skill-tree", labelKey: "nav.skillTree" },
  { to: "/tax-optimizer", labelKey: "nav.taxOptimizer" },
];

function isMarketsPath(pathname: string): boolean {
  return pathname.startsWith("/signals") || pathname.startsWith("/dividend") || pathname.startsWith("/alpha");
}

function isPortfolioPath(pathname: string): boolean {
  return (
    pathname.startsWith("/paper-trading") ||
    pathname.startsWith("/mirror-trading") ||
    pathname.startsWith("/coach") ||
    pathname.startsWith("/mistake-library") ||
    pathname.startsWith("/psyche-profile") ||
    pathname.startsWith("/stress-test") ||
    pathname.startsWith("/concentration")
  );
}

function isToolsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/position-size") ||
    pathname.startsWith("/premortem") ||
    pathname.startsWith("/correlation") ||
    pathname.startsWith("/volatility") ||
    pathname.startsWith("/crowd-wisdom") ||
    pathname.startsWith("/dividend-compound") ||
    pathname.startsWith("/glossary") ||
    pathname.startsWith("/skill-tree") ||
    pathname.startsWith("/tax-optimizer")
  );
}

function navLinkClass(isActive: boolean): string {
  return `nav-link-chrome block rounded px-2 py-1.5 text-sm ${
    isActive ? "is-active text-brand-green" : "text-slate-300 hover:text-brand-blue"
  }`;
}

function triggerClass(active: boolean): string {
  return `nav-link-chrome inline-flex items-center gap-0.5 rounded px-2 py-1.5 text-sm ${
    active ? "is-active text-brand-green" : "text-slate-300 hover:text-brand-blue"
  }`;
}

type DesktopDropdownProps = {
  id: DropdownId;
  labelKey: string;
  items: { to: string; labelKey: string }[];
  groupActive: boolean;
  openDropdown: DropdownId | null;
  setOpenDropdown: (v: DropdownId | null) => void;
};

function DesktopDropdown({ id, labelKey, items, groupActive, openDropdown, setOpenDropdown }: DesktopDropdownProps) {
  const { t } = useTranslation();
  const open = openDropdown === id;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpenDropdown]);

  return (
    <div
      ref={containerRef}
      className="relative hidden md:block"
      onMouseEnter={() => setOpenDropdown(id)}
      onMouseLeave={() => setOpenDropdown(null)}
    >
      <button
        type="button"
        className={triggerClass(groupActive)}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpenDropdown(open ? null : id)}
      >
        {t(labelKey)}
        <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 -mt-0.5 min-w-[13.5rem] pt-2">
          <div className="neo-panel rounded-xl border border-brand-border/90 py-1 shadow-lg">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${navLinkClass(isActive)} px-3`}
                onClick={() => setOpenDropdown(null)}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppNavBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const marketsActive = isMarketsPath(pathname);
  const portfolioActive = isPortfolioPath(pathname);
  const toolsActive = isToolsPath(pathname);

  return (
    <nav className="glass-nav relative z-20">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <Link to="/" className="shrink-0">
          <img src="/logo.png" alt="StockAI Pro" className="h-8 w-40 object-cover object-center" />
        </Link>

        <button
          type="button"
          className="ml-auto inline-flex rounded-lg border border-brand-border/80 p-2 text-slate-200 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <XMarkIcon className="h-6 w-6" aria-hidden /> : <Bars3Icon className="h-6 w-6" aria-hidden />}
          <span className="sr-only">{t("nav.menu")}</span>
        </button>

        <div className="hidden min-w-0 flex-1 items-center gap-x-1 gap-y-2 md:flex md:gap-x-3">
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
            {t("nav.dashboard")}
          </NavLink>
          <DesktopDropdown
            id="markets"
            labelKey="nav.markets"
            items={marketsLinks}
            groupActive={marketsActive}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <DesktopDropdown
            id="portfolio"
            labelKey="nav.portfolio"
            items={portfolioLinks}
            groupActive={portfolioActive}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
          <DesktopDropdown
            id="tools"
            labelKey="nav.tools"
            items={toolsLinks}
            groupActive={toolsActive}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
        </div>

        <div className="hidden shrink-0 md:block">
          <LanguageSwitcher />
        </div>
      </div>

      <div
        id="mobile-nav-panel"
        className={`border-t border-brand-border/60 bg-[rgb(11_14_17/0.97)] backdrop-blur-md md:hidden ${
          mobileOpen ? "block" : "hidden"
        }`}
      >
        <div className="mx-auto max-h-[min(70vh,calc(100dvh-5rem))] max-w-6xl space-y-5 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1">
            <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)} onClick={() => setMobileOpen(false)}>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)} onClick={() => setMobileOpen(false)}>
              {t("nav.dashboard")}
            </NavLink>
          </div>
          <MobileSection titleKey="nav.markets" links={marketsLinks} onNavigate={() => setMobileOpen(false)} />
          <MobileSection titleKey="nav.portfolio" links={portfolioLinks} onNavigate={() => setMobileOpen(false)} />
          <MobileSection titleKey="nav.tools" links={toolsLinks} onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-brand-border/50 pt-4">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileSection({
  titleKey,
  links,
  onNavigate,
}: {
  titleKey: string;
  links: { to: string; labelKey: string }[];
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(titleKey)}</div>
      <div className="flex flex-col gap-0.5 border-l border-brand-border/60 pl-3">
        {links.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkClass(isActive)} onClick={onNavigate}>
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

