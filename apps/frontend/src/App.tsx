import { Navigate, Route, Routes } from "react-router-dom";
import { AppNavBar } from "./components/AppNavBar";
import { AlphaCalendarPage } from "./pages/AlphaCalendarPage";
import { BehavioralCoachPage } from "./pages/BehavioralCoachPage";
import { CompanyDetail } from "./pages/CompanyDetail";
import { ConcentrationPage } from "./pages/ConcentrationPage";
import { Dashboard } from "./pages/Dashboard";
import { DividendIntelligencePage } from "./pages/DividendIntelligencePage";
import { Dividends } from "./pages/Dividends";
import { Home } from "./pages/Home";
import { MistakeLibraryPage } from "./pages/MistakeLibraryPage";
import { PaperTradingPage } from "./pages/PaperTradingPage";
import { PositionSizePage } from "./pages/PositionSizePage";
import { PreMortemPage } from "./pages/PreMortemPage";
import { ReplayModePage } from "./pages/ReplayModePage";
import { SignalsPage } from "./pages/SignalsPage";
import { StressTestPage } from "./pages/StressTestPage";
import { TaxOptimizerPage } from "./pages/TaxOptimizerPage";
import { EmotionalStateWidget } from "./components/EmotionalStateWidget";

export default function App() {
  return (
    <div className="app-shell min-h-screen">
      <AppNavBar />
      <EmotionalStateWidget />

      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/dividend" element={<Dividends />} />
          <Route path="/dividend/intelligence" element={<DividendIntelligencePage />} />
          <Route path="/paper-trading" element={<PaperTradingPage />} />
          <Route path="/coach" element={<BehavioralCoachPage />} />
          <Route path="/mistake-library" element={<MistakeLibraryPage />} />
          <Route path="/alpha" element={<AlphaCalendarPage />} />
          <Route path="/position-size" element={<PositionSizePage />} />
          <Route path="/premortem" element={<PreMortemPage />} />
          <Route path="/replay" element={<ReplayModePage />} />
          <Route path="/tax-optimizer" element={<TaxOptimizerPage />} />
          <Route path="/stress-test" element={<StressTestPage />} />
          <Route path="/concentration" element={<ConcentrationPage />} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
