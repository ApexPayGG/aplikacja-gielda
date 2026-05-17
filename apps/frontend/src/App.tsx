import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppNavBar } from "./components/AppNavBar";
import { MobileBottomNav } from "./components/MobileBottomNav";
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
import { DividendPage } from "./pages/DividendPage";
import { Home } from "./pages/Home";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { LossStreakPage } from "./pages/LossStreakPage";
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
import { OnboardingPage } from "./pages/OnboardingPage";
import { PremiumCompanyAnalysis } from "./pages/PremiumCompanyAnalysis";
import { WeeklyReviewPage } from "./pages/WeeklyReviewPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { hasCompletedOnboarding } from "./utils/onboarding";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ErrorPage } from "./pages/ErrorPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  const onboardingCompleted = hasCompletedOnboarding();
  if (isLoading) {
    return <div className="mx-auto flex min-h-screen items-center justify-center text-slate-300">Loading...</div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!onboardingCompleted && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { token } = useAuth();
  const location = useLocation();
  const onboardingCompleted = hasCompletedOnboarding();
  const defaultAuthenticatedRoute = onboardingCompleted ? "/dashboard" : "/onboarding";
  const inOnboarding = location.pathname.startsWith("/onboarding");
  const showTopNavigation = token && !inOnboarding;
  const showFloatingEmotionalWidget = token && !location.pathname.startsWith("/dashboard") && !inOnboarding;

  return (
    <div className="app-shell min-h-screen">
      {showTopNavigation ? <AppNavBar /> : null}
      {showFloatingEmotionalWidget ? <EmotionalStateWidget /> : null}

      <main className={`relative z-10 ${token ? "pb-16 md:pb-0" : ""}`}>
        <Routes>
          <Route path="/login" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <LoginPage />} />
          <Route path="/register" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <RegisterPage />} />
          <Route path="/verify" element={<VerifyEmailPage />} />
          <Route
            path="/onboarding"
            element={token && onboardingCompleted ? <Navigate to="/dashboard" replace /> : <OnboardingPage />}
          />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="/error" element={<ErrorPage />} />

          <Route path="/" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <LandingPage />} />
          <Route path="/companies" element={<Home />} />
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/track-record/public/:hash" element={<TrackRecordPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/paper-trading" element={<ProtectedRoute><PaperTradingPage /></ProtectedRoute>} />
          <Route path="/behavioral-coach" element={<ProtectedRoute><BehavioralCoachPage /></ProtectedRoute>} />
          <Route path="/loss-streak" element={<ProtectedRoute><LossStreakPage /></ProtectedRoute>} />
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

          <Route path="/dividend" element={<DividendPage />} />
          <Route path="/dividend/intelligence" element={<ProtectedRoute><DividendIntelligencePage /></ProtectedRoute>} />
          <Route path="/admin/affiliate" element={<ProtectedRoute><AdminAffiliatePage /></ProtectedRoute>} />
          <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
          <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
          <Route path="/company/:symbol/premium" element={<ProtectedRoute><PremiumCompanyAnalysis /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
      {token ? <MobileBottomNav /> : null}
    </div>
  );
}
