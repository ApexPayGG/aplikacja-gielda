import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AlphaCalendarPage } from "./pages/AlphaCalendarPage";
import { BehavioralCoachPage } from "./pages/BehavioralCoachPage";
import { CompanyDetail } from "./pages/CompanyDetail";
import { Dashboard } from "./pages/Dashboard";
import { DividendIntelligencePage } from "./pages/DividendIntelligencePage";
import { Dividends } from "./pages/Dividends";
import { Home } from "./pages/Home";
import { PaperTradingPage } from "./pages/PaperTradingPage";
import { SignalsPage } from "./pages/SignalsPage";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

const navLinks: NavItem[] = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/signals", label: "Signals" },
  { to: "/dividend", label: "Dividend" },
  { to: "/dividend/intelligence", label: "Dividend Intelligence" },
  { to: "/paper-trading", label: "Paper Trading" },
  { to: "/coach", label: "Coach" },
  { to: "/alpha", label: "Alpha Calendar" },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[#0f1f36] bg-[#060d18]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-white">
            StockAI <span className="text-[#0096ff]">Pro</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `transition-colors ${isActive ? "text-[#00c87a]" : "text-slate-300 hover:text-[#0096ff]"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/dividend" element={<Dividends />} />
          <Route path="/dividend/intelligence" element={<DividendIntelligencePage />} />
          <Route path="/paper-trading" element={<PaperTradingPage />} />
          <Route path="/coach" element={<BehavioralCoachPage />} />
          <Route path="/alpha" element={<AlphaCalendarPage />} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
