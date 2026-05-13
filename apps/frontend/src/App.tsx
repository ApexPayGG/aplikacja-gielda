import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppNavBar } from "./components/AppNavBar";
import { EmotionalStateWidget } from "./components/EmotionalStateWidget";
import { useAuth } from "./context/AuthContext";
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
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
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
import { RegisterPage } from "./pages/RegisterPage";
import { AlpacaDashboardPage } from "./pages/AlpacaDashboardPage";
import { AdminAffiliatePage } from "./pages/AdminAffiliatePage";
import { PremiumCompanyAnalysis } from "./pages/PremiumCompanyAnalysis";
import { WeeklyReviewPage } from "./pages/WeeklyReviewPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="mx-auto flex min-h-screen items-center justify-center text-slate-300">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app-shell min-h-screen">
      {user ? <AppNavBar /> : null}
      {user ? <EmotionalStateWidget /> : null}

      <main className="relative z-10">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route path="/" element={<RequireAuth><LandingPage /></RequireAuth>} />
          <Route path="/companies" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/signals" element={<RequireAuth><SignalsPage /></RequireAuth>} />
          <Route path="/dividend" element={<RequireAuth><Dividends /></RequireAuth>} />
          <Route path="/dividend/intelligence" element={<RequireAuth><DividendIntelligencePage /></RequireAuth>} />
          <Route path="/paper-trading" element={<RequireAuth><PaperTradingPage /></RequireAuth>} />
          <Route path="/mirror-trading" element={<RequireAuth><MirrorTradingPage /></RequireAuth>} />
          <Route path="/coach" element={<RequireAuth><BehavioralCoachPage /></RequireAuth>} />
          <Route path="/mistake-library" element={<RequireAuth><MistakeLibraryPage /></RequireAuth>} />
          <Route path="/psyche-profile" element={<RequireAuth><PsycheProfilePage /></RequireAuth>} />
          <Route path="/weekly-review" element={<RequireAuth><WeeklyReviewPage /></RequireAuth>} />
          <Route path="/alpha" element={<RequireAuth><AlphaCalendarPage /></RequireAuth>} />
          <Route path="/position-size" element={<RequireAuth><PositionSizePage /></RequireAuth>} />
          <Route path="/premortem" element={<RequireAuth><PreMortemPage /></RequireAuth>} />
          <Route path="/reverse-screener" element={<RequireAuth><ReverseScreenerPage /></RequireAuth>} />
          <Route path="/replay" element={<RequireAuth><ReplayModePage /></RequireAuth>} />
          <Route path="/strategy-dna" element={<RequireAuth><StrategyDnaPage /></RequireAuth>} />
          <Route path="/track-record" element={<RequireAuth><TrackRecordPage /></RequireAuth>} />
          <Route path="/crowd-wisdom" element={<RequireAuth><CrowdWisdomPage /></RequireAuth>} />
          <Route path="/glossary" element={<RequireAuth><GlossaryPage /></RequireAuth>} />
          <Route path="/digest" element={<RequireAuth><DigestPage /></RequireAuth>} />
          <Route path="/skill-tree" element={<RequireAuth><SkillTreePage /></RequireAuth>} />
          <Route path="/earnings-predictor" element={<RequireAuth><EarningsPredictorPage /></RequireAuth>} />
          <Route path="/insider-mirror" element={<RequireAuth><InsiderMirrorPage /></RequireAuth>} />
          <Route path="/news-halflife" element={<RequireAuth><NewsHalfLifePage /></RequireAuth>} />
          <Route path="/volatility" element={<RequireAuth><VolatilityHeatMapPage /></RequireAuth>} />
          <Route path="/backtest" element={<RequireAuth><WalkForwardPage /></RequireAuth>} />
          <Route path="/tax-optimizer" element={<RequireAuth><TaxOptimizerPage /></RequireAuth>} />
          <Route path="/stress-test" element={<RequireAuth><StressTestPage /></RequireAuth>} />
          <Route path="/concentration" element={<RequireAuth><ConcentrationPage /></RequireAuth>} />
          <Route path="/correlation" element={<RequireAuth><CorrelationPage /></RequireAuth>} />
          <Route path="/dividend-compound" element={<RequireAuth><DividendCompoundPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/alpaca" element={<RequireAuth><AlpacaDashboardPage /></RequireAuth>} />
          <Route path="/admin/affiliate" element={<RequireAuth><AdminAffiliatePage /></RequireAuth>} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol" element={<RequireAuth><CompanyDetail /></RequireAuth>} />
          <Route path="/company/:symbol/premium" element={<RequireAuth><PremiumCompanyAnalysis /></RequireAuth>} />
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </main>
    </div>
  );
}
