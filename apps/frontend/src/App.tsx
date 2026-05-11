import { Navigate, Route, Routes } from "react-router-dom";
import { AppNavBar } from "./components/AppNavBar";
import { AlphaCalendarPage } from "./pages/AlphaCalendarPage";
import { BehavioralCoachPage } from "./pages/BehavioralCoachPage";
import { CompanyDetail } from "./pages/CompanyDetail";
import { ConcentrationPage } from "./pages/ConcentrationPage";
import { CorrelationPage } from "./pages/CorrelationPage";
import { Dashboard } from "./pages/Dashboard";
import { DividendCompoundPage } from "./pages/DividendCompoundPage";
import { DividendIntelligencePage } from "./pages/DividendIntelligencePage";
import { Dividends } from "./pages/Dividends";
import { Home } from "./pages/Home";
import { MistakeLibraryPage } from "./pages/MistakeLibraryPage";
import { PsycheProfilePage } from "./pages/PsycheProfilePage";
import { PaperTradingPage } from "./pages/PaperTradingPage";
import { PositionSizePage } from "./pages/PositionSizePage";
import { PreMortemPage } from "./pages/PreMortemPage";
import { ReverseScreenerPage } from "./pages/ReverseScreenerPage";
import { ReplayModePage } from "./pages/ReplayModePage";
import { StrategyDnaPage } from "./pages/StrategyDnaPage";
import { TrackRecordPage } from "./pages/TrackRecordPage";
import { CrowdWisdomPage } from "./pages/CrowdWisdomPage";
import { GlossaryPage } from "./pages/GlossaryPage";
import { DigestPage } from "./pages/DigestPage";
import { SkillTreePage } from "./pages/SkillTreePage";
import { EarningsPredictorPage } from "./pages/EarningsPredictorPage";
import { InsiderMirrorPage } from "./pages/InsiderMirrorPage";
import { NewsHalfLifePage } from "./pages/NewsHalfLifePage";
import { SignalsPage } from "./pages/SignalsPage";
import { StressTestPage } from "./pages/StressTestPage";
import { SettingsPage } from "./pages/SettingsPage";
import { MirrorTradingPage } from "./pages/MirrorTradingPage";
import { TaxOptimizerPage } from "./pages/TaxOptimizerPage";
import { VolatilityHeatMapPage } from "./pages/VolatilityHeatMapPage";
import { WalkForwardPage } from "./pages/WalkForwardPage";
import { AlpacaDashboardPage } from "./pages/AlpacaDashboardPage";
import { AdminAffiliatePage } from "./pages/AdminAffiliatePage";
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
          <Route path="/mirror-trading" element={<MirrorTradingPage />} />
          <Route path="/coach" element={<BehavioralCoachPage />} />
          <Route path="/mistake-library" element={<MistakeLibraryPage />} />
          <Route path="/psyche-profile" element={<PsycheProfilePage />} />
          <Route path="/alpha" element={<AlphaCalendarPage />} />
          <Route path="/position-size" element={<PositionSizePage />} />
          <Route path="/premortem" element={<PreMortemPage />} />
          <Route path="/reverse-screener" element={<ReverseScreenerPage />} />
          <Route path="/replay" element={<ReplayModePage />} />
          <Route path="/strategy-dna" element={<StrategyDnaPage />} />
          <Route path="/track-record" element={<TrackRecordPage />} />
          <Route path="/crowd-wisdom" element={<CrowdWisdomPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/digest" element={<DigestPage />} />
          <Route path="/skill-tree" element={<SkillTreePage />} />
          <Route path="/earnings-predictor" element={<EarningsPredictorPage />} />
          <Route path="/insider-mirror" element={<InsiderMirrorPage />} />
          <Route path="/news-halflife" element={<NewsHalfLifePage />} />
          <Route path="/volatility" element={<VolatilityHeatMapPage />} />
          <Route path="/backtest" element={<WalkForwardPage />} />
          <Route path="/tax-optimizer" element={<TaxOptimizerPage />} />
          <Route path="/stress-test" element={<StressTestPage />} />
          <Route path="/concentration" element={<ConcentrationPage />} />
          <Route path="/correlation" element={<CorrelationPage />} />
          <Route path="/dividend-compound" element={<DividendCompoundPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/alpaca" element={<AlpacaDashboardPage />} />
          <Route path="/admin/affiliate" element={<AdminAffiliatePage />} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
