import { BriefcaseIcon, ChartBarSquareIcon, HomeIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { hasCompletedOnboarding } from "../utils/onboarding";

type BottomNavItem = {
  to: string;
  labelKey: string;
  icon: typeof HomeIcon;
  isActive: (pathname: string) => boolean;
};

function isMarketsPath(pathname: string): boolean {
  return (
    pathname.startsWith("/signals") ||
    pathname.startsWith("/dividend") ||
    pathname.startsWith("/alpha") ||
    pathname.startsWith("/companies") ||
    pathname.startsWith("/company/")
  );
}

function isPortfolioPath(pathname: string): boolean {
  return (
    pathname.startsWith("/paper-trading") ||
    pathname.startsWith("/alpaca") ||
    pathname.startsWith("/mirror-trading") ||
    pathname.startsWith("/behavioral-coach") ||
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

export function MobileBottomNav() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { pathname } = useLocation();
  const glass = Boolean(token) && hasCompletedOnboarding();

  const items: BottomNavItem[] = [
    { to: "/dashboard", labelKey: "nav.dashboard", icon: HomeIcon, isActive: (path) => path.startsWith("/dashboard") },
    { to: "/signals", labelKey: "nav.markets", icon: ChartBarSquareIcon, isActive: isMarketsPath },
    { to: "/paper-trading", labelKey: "nav.portfolio", icon: BriefcaseIcon, isActive: isPortfolioPath },
    { to: "/position-size", labelKey: "nav.tools", icon: WrenchScrewdriverIcon, isActive: isToolsPath },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-20 border-t md:hidden ${
        glass
          ? "border-white/10 bg-[#0a0b14]/92 backdrop-blur-lg"
          : "border-border bg-bgPrimary"
      }`}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive(pathname);
          return (
            <li key={item.to}>
              <NavLink to={item.to} className="flex flex-col items-center justify-center gap-1 px-2 py-2.5">
                <Icon
                  className={`h-5 w-5 ${isActive ? (glass ? "text-[#22d3ee]" : "text-brandDark") : glass ? "text-white/50" : "text-textMuted"}`}
                  aria-hidden
                />
                <span
                  className={`text-[11px] font-semibold ${isActive ? (glass ? "text-[#22d3ee]" : "text-brandDark") : glass ? "text-white/50" : "text-textMuted"}`}
                >
                  {t(item.labelKey)}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
