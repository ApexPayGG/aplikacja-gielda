import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return <div className="mx-auto flex min-h-screen items-center justify-center text-slate-300">Loading...</div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { token } = useAuth();
  const location = useLocation();
  const showFloatingEmotionalWidget = token && !location.pathname.startsWith("/dashboard");

  return (
    <div className="app-shell min-h-screen">
      {token ? <AppNavBar /> : null}
      {showFloatingEmotionalWidget ? <EmotionalStateWidget /> : null}

      <main className="relative z-10">
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
          <Route path="/register" element={token ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
          <Route path="/verify" element={<VerifyEmailPage />} />

          <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/companies" element={<Home />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/track-record/public/:hash" element={<TrackRecordPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/paper-trading" element={<ProtectedRoute><PaperTradingPage /></ProtectedRoute>} />
          <Route path="/behavioral-coach" element={<ProtectedRoute><BehavioralCoachPage /></ProtectedRoute>} />
          <Route path="/coach" element={<Navigate to="/behavioral-coach" replace />} />
          <Route path="/psyche-profile" element={<ProtectedRoute><PsycheProfilePage /></ProtectedRoute>} />
          <Route path="/weekly-review" element={<ProtectedRoute><WeeklyReviewPage /></ProtectedRoute>} />
          <Route path="/alpaca" element={<ProtectedRoute><AlpacaDashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/mistake-library" element={<ProtectedRoute><MistakeLibraryPage /></ProtectedRoute>} />
          <Route path="/skill-tree" element={<ProtectedRoute><SkillTreePage /></ProtectedRoute>} />
          <Route path="/mirror-trading" element={<ProtectedRoute><MirrorTradingPage /></ProtectedRoute>} />
          <Route path="/digest" element={<ProtectedRoute><DigestPage /></ProtectedRoute>} />
          <Route path="/position-size" element={<ProtectedRoute><PositionSizePage /></ProtectedRoute>} />
          <Route path="/stress-test" element={<ProtectedRoute><StressTestPage /></ProtectedRoute>} />
          <Route path="/concentration" element={<ProtectedRoute><ConcentrationPage /></ProtectedRoute>} />
          <Route path="/tax-optimizer" element={<ProtectedRoute><TaxOptimizerPage /></ProtectedRoute>} />
          <Route path="/premortem" element={<ProtectedRoute><PreMortemPage /></ProtectedRoute>} />
          <Route path="/strategy-dna" element={<ProtectedRoute><StrategyDnaPage /></ProtectedRoute>} />
          <Route path="/track-record" element={<ProtectedRoute><TrackRecordPage /></ProtectedRoute>} />
          <Route path="/replay" element={<ProtectedRoute><ReplayModePage /></ProtectedRoute>} />
          <Route path="/backtest" element={<ProtectedRoute><WalkForwardPage /></ProtectedRoute>} />
          <Route path="/earnings-predictor" element={<ProtectedRoute><EarningsPredictorPage /></ProtectedRoute>} />
          <Route path="/insider-mirror" element={<ProtectedRoute><InsiderMirrorPage /></ProtectedRoute>} />
          <Route path="/reverse-screener" element={<ProtectedRoute><ReverseScreenerPage /></ProtectedRoute>} />
          <Route path="/correlation" element={<ProtectedRoute><CorrelationPage /></ProtectedRoute>} />
          <Route path="/volatility" element={<ProtectedRoute><VolatilityHeatMapPage /></ProtectedRoute>} />
          <Route path="/news-halflife" element={<ProtectedRoute><NewsHalfLifePage /></ProtectedRoute>} />
          <Route path="/crowd-wisdom" element={<ProtectedRoute><CrowdWisdomPage /></ProtectedRoute>} />
          <Route path="/dividend-compound" element={<ProtectedRoute><DividendCompoundPage /></ProtectedRoute>} />
          <Route path="/alpha-calendar" element={<ProtectedRoute><AlphaCalendarPage /></ProtectedRoute>} />
          <Route path="/alpha" element={<Navigate to="/alpha-calendar" replace />} />

          <Route path="/dividend" element={<Dividends />} />
          <Route path="/dividend/intelligence" element={<ProtectedRoute><DividendIntelligencePage /></ProtectedRoute>} />
          <Route path="/admin/affiliate" element={<ProtectedRoute><AdminAffiliatePage /></ProtectedRoute>} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol/premium" element={<ProtectedRoute><PremiumCompanyAnalysis /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
