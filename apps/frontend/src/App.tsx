import { Link, Navigate, Route, Routes } from "react-router-dom";
import { CompanyDetail } from "./pages/CompanyDetail";
import { Dashboard } from "./pages/Dashboard";
import { DividendIntelligencePage } from "./pages/DividendIntelligencePage";
import { Dividends } from "./pages/Dividends";
import { Home } from "./pages/Home";

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-surface-border bg-surface-elevated/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-white">
            StockAI <span className="text-accent-muted">Pro</span>
          </Link>
          <div className="flex gap-6 text-sm">
            <Link to="/" className="text-slate-400 hover:text-white">
              Companies
            </Link>
            <Link to="/dashboard" className="text-slate-400 hover:text-white">
              Dashboard
            </Link>
            <Link to="/dividends" className="text-slate-400 hover:text-white">
              Dividends
            </Link>
            <Link to="/intelligence/dividends" className="text-slate-400 hover:text-white">
              Dividend Intelligence
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/intelligence/dividends" element={<DividendIntelligencePage />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
