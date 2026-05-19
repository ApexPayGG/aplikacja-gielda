import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BriefcaseIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import LanguageSwitcher from "./LanguageSwitcher";
import { NotificationsCenter } from "./NotificationsCenter";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

type DropdownId = "markets" | "portfolio" | "tools";
type MobileDrawerLink = {
  to: string;
  label: string;
  icon: typeof ChartBarSquareIcon;
  isActive: (pathname: string) => boolean;
};

const marketsLinks: { to: string; labelKey: string }[] = [
  { to: "/signals", labelKey: "nav.signals" },
  { to: "/dividend", labelKey: "nav.dividend" },
  { to: "/dividend/intelligence", labelKey: "nav.dividendIntelligence" },
  { to: "/alpha", labelKey: "nav.alphaCalendar" },
];

const portfolioLinks: { to: string; labelKey: string }[] = [
  { to: "/paper-trading", labelKey: "nav.paperTrading" },
  { to: "/alpaca", labelKey: "nav.alpacaTrading" },
  { to: "/mirror-trading", labelKey: "nav.mirrorTrading" },
  { to: "/coach", labelKey: "nav.coach" },
  { to: "/mistake-library", labelKey: "nav.mistakeLibrary" },
  { to: "/psyche-profile", labelKey: "nav.psycheProfile" },
  { to: "/weekly-review", labelKey: "nav.weeklyReview" },
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
  { to: "/admin/affiliate", labelKey: "nav.adminAffiliate" },
];

function isMarketsPath(pathname: string): boolean {
  return pathname.startsWith("/signals") || pathname.startsWith("/dividend") || pathname.startsWith("/alpha");
}

function isPortfolioPath(pathname: string): boolean {
  return (
    pathname.startsWith("/paper-trading") ||
    pathname.startsWith("/alpaca") ||
    pathname.startsWith("/mirror-trading") ||
    pathname.startsWith("/coach") ||
    pathname.startsWith("/mistake-library") ||
    pathname.startsWith("/psyche-profile") ||
    pathname.startsWith("/weekly-review") ||
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
    pathname.startsWith("/tax-optimizer") ||
    pathname.startsWith("/admin/affiliate")
  );
}

function isAccountPath(pathname: string): boolean {
  return pathname.startsWith("/settings") || pathname.startsWith("/profile");
}

function getUserInitials(name: string | null, email: string): string {
  if (name) {
    const tokens = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length > 0) {
      return tokens
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
    }
  }

  const fallback = email.split("@")[0] ?? "";
  if (!fallback) {
    return "U";
  }

  return fallback.slice(0, 2).toUpperCase();
}

function navLinkClass(isActive: boolean): string {
  return `block rounded-md border-b-2 px-2 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "border-brandDark text-brandDark" : "border-transparent text-textSecondary hover:text-brandDark"
  }`;
}

function triggerClass(active: boolean): string {
  return `inline-flex items-center gap-0.5 rounded-md border-b-2 px-2 py-1.5 text-sm font-medium transition-colors ${
    active ? "border-brandDark text-brandDark" : "border-transparent text-textSecondary hover:text-brandDark"
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
          <div className="rounded-xl border border-border bg-bgPrimary py-1 shadow-lg">
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountLabel = t("nav.account", { defaultValue: "Account" });
  const profileLabel = t("nav.profile", { defaultValue: "Mój profil" });
  const settingsLabel = t("nav.settings", { defaultValue: "Ustawienia" });
  const logoutLabel = t("nav.logout", { defaultValue: "Wyloguj" });

  const mobileDrawerLinks: MobileDrawerLink[] = [
    {
      to: "/about",
      label: t("nav.about", { defaultValue: "O nas" }),
      icon: InformationCircleIcon,
      isActive: (path) => path.startsWith("/about"),
    },
    { to: "/signals", label: t("nav.markets"), icon: ChartBarSquareIcon, isActive: isMarketsPath },
    { to: "/paper-trading", label: t("nav.portfolio"), icon: BriefcaseIcon, isActive: isPortfolioPath },
    { to: "/position-size", label: t("nav.tools"), icon: WrenchScrewdriverIcon, isActive: isToolsPath },
    { to: "/profile", label: profileLabel, icon: UserCircleIcon, isActive: isAccountPath },
    { to: "/settings", label: settingsLabel, icon: UserCircleIcon, isActive: isAccountPath },
  ];

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const marketsActive = isMarketsPath(pathname);
  const portfolioActive = isPortfolioPath(pathname);
  const toolsActive = isToolsPath(pathname);
  const userName = user?.name?.trim() || null;
  const userEmail = user?.email ?? "";
  const userInitials = getUserInitials(userName, userEmail);

  const handleLogout = (): void => {
    logout();
    navigate("/");
  };

  return (
    <nav className="relative z-20 border-b border-border bg-bgPrimary dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <Link to="/" className="shrink-0">
          <img
            src="/logo.png"
            alt="StockAI Pro"
            className="h-8 w-auto max-w-[220px] object-contain object-left"
          />
        </Link>

        <button
          type="button"
          className="ml-auto inline-flex h-11 w-11 flex-col items-center justify-center rounded-lg border border-border md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span
            aria-hidden
            className={`block h-0.5 w-6 bg-brandDark transition-transform duration-300 ${
              mobileOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            aria-hidden
            className={`my-1 block h-0.5 w-6 bg-brandDark transition-opacity duration-200 ${
              mobileOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            aria-hidden
            className={`block h-0.5 w-6 bg-brandDark transition-transform duration-300 ${
              mobileOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
          <span className="sr-only">{t("nav.menu")}</span>
        </button>

        <div className="hidden min-w-0 flex-1 items-center gap-x-1 gap-y-2 md:flex md:gap-x-3">
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => navLinkClass(isActive)}>
            {t("nav.about", { defaultValue: "O nas" })}
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

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <p className="text-xs text-textMuted">Naciśnij ? aby zobaczyć skróty</p>
          <NotificationsCenter />
          <ThemeToggle />
          {user ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition hover:border-brandDark/35"
                aria-expanded={accountOpen}
                aria-haspopup="true"
              >
                <div className="max-w-[18rem] text-right">
                  {userName ? <div className="text-xs text-brandDark">{userName}</div> : null}
                  <div className="break-all text-[11px] text-brandDark">{userEmail}</div>
                </div>
                <ChevronDownIcon className="h-4 w-4 text-brandDark" aria-hidden />
              </button>
              {accountOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-border bg-bgPrimary py-1 shadow-lg">
                  <NavLink
                    to="/profile"
                    className={({ isActive }) => `${navLinkClass(isActive)} rounded-none px-3`}
                    onClick={() => setAccountOpen(false)}
                  >
                    {profileLabel}
                  </NavLink>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) => `${navLinkClass(isActive)} rounded-none px-3`}
                    onClick={() => setAccountOpen(false)}
                  >
                    {settingsLabel}
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      handleLogout();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm font-medium text-negative transition hover:bg-bgSecondary"
                  >
                    {logoutLabel}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <LanguageSwitcher />
        </div>
      </div>

      <div
        className={`fixed inset-0 z-30 bg-textPrimary/30 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        id="mobile-nav-panel"
        className={`fixed right-0 top-0 z-40 flex h-dvh w-[min(88vw,22rem)] flex-col bg-bgPrimary shadow-[-12px_0_28px_rgba(13,13,26,0.14)] transition-transform duration-300 md:hidden ${
          mobileOpen ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
      >
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brandDark text-sm font-semibold text-white">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">{accountLabel}</p>
              <p className="truncate text-sm font-medium text-brandDark">{userEmail || userName || "—"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {mobileDrawerLinks.map((item) => {
            const Icon = item.icon;
            const isActive = item.isActive(pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 border-b border-border px-6 py-4 text-base font-semibold transition-colors ${
                  isActive
                    ? "border-l-4 border-l-brandCyan bg-bgSecondary/40 pl-5 text-brandDark"
                    : "border-l-4 border-l-transparent text-textSecondary hover:text-brandDark"
                }`}
                tabIndex={mobileOpen ? 0 : -1}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border px-6 py-4">
          <LanguageSwitcher />
        </div>

        {user ? (
          <div className="border-t border-border px-6 py-5">
            <button
              type="button"
              tabIndex={mobileOpen ? 0 : -1}
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="text-sm font-semibold text-negative transition-colors hover:opacity-80"
            >
              {logoutLabel}
            </button>
          </div>
        ) : null}
      </aside>
    </nav>
  );
}

