import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { AlphaCalendarPage } from "./pages/AlphaCalendarPage";
import { BehavioralCoachPage } from "./pages/BehavioralCoachPage";
import { CompanyDetail } from "./pages/CompanyDetail";
import { Dashboard } from "./pages/Dashboard";
import { DividendIntelligencePage } from "./pages/DividendIntelligencePage";
import { Dividends } from "./pages/Dividends";
import { Home } from "./pages/Home";
import { PaperTradingPage } from "./pages/PaperTradingPage";
import { PositionSizePage } from "./pages/PositionSizePage";
import { SignalsPage } from "./pages/SignalsPage";
import { StressTestPage } from "./pages/StressTestPage";

type NavItem = {
  to: string;
  labelKey: string;
  end?: boolean;
};

const navLinks: NavItem[] = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/signals", labelKey: "nav.signals" },
  { to: "/dividend", labelKey: "nav.dividend" },
  { to: "/dividend/intelligence", labelKey: "nav.dividendIntelligence" },
  { to: "/paper-trading", labelKey: "nav.paperTrading" },
  { to: "/coach", labelKey: "nav.coach" },
  { to: "/alpha", labelKey: "nav.alphaCalendar" },
  { to: "/position-size", labelKey: "nav.positionSize" },
  { to: "/stress-test", labelKey: "nav.stressTest" },
];

export default function App() {
  const { t } = useTranslation();

  return (
    <div className="app-shell min-h-screen">
      <nav className="glass-nav relative z-10">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-white">
            StockAI <span className="text-gradient-brand">Pro</span>
          </Link>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-x-4 gap-y-2 text-sm">
              {navLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `nav-link-chrome ${isActive ? "is-active text-brand-green" : "text-slate-300 hover:text-brand-blue"}`
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/dividend" element={<Dividends />} />
          <Route path="/dividend/intelligence" element={<DividendIntelligencePage />} />
          <Route path="/paper-trading" element={<PaperTradingPage />} />
          <Route path="/coach" element={<BehavioralCoachPage />} />
          <Route path="/alpha" element={<AlphaCalendarPage />} />
          <Route path="/position-size" element={<PositionSizePage />} />
          <Route path="/stress-test" element={<StressTestPage />} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
