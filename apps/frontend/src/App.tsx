import type { ComponentType, ReactNode } from "react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLegalFooter } from "./components/AppLegalFooter";
import { AppNavBar } from "./components/AppNavBar";
import { CookieConsent } from "./components/CookieConsent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { KeyboardShortcutsHelp } from "./components/KeyboardShortcutsHelp";
import { LoadingScreen } from "./components/LoadingScreen";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { EmotionalStateWidget } from "./components/EmotionalStateWidget";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { useAuth } from "./context/AuthContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { initializeGA4 } from "./utils/analytics";
import { getCookieConsent, type CookieConsentType } from "./utils/cookieConsent";
import { GlassAmbient } from "./components/behavioral-coach/GlassAmbient";
import { hasCompletedOnboarding } from "./utils/onboarding";

function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  key: TKey,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[key] as ComponentType };
  });
}

const AlphaCalendarPage = lazyNamed(() => import("./pages/AlphaCalendarPage"), "AlphaCalendarPage");
const BehavioralCoachPage = lazyNamed(() => import("./pages/BehavioralCoachPage"), "BehavioralCoachPage");
const CompanyDetail = lazyNamed(() => import("./pages/CompanyDetail"), "CompanyDetail");
const ConcentrationPage = lazyNamed(() => import("./pages/ConcentrationPage"), "ConcentrationPage");
const CorrelationPage = lazyNamed(() => import("./pages/CorrelationPage"), "CorrelationPage");
const Dashboard = lazyNamed(() => import("./pages/Dashboard"), "Dashboard");
const DividendCompoundPage = lazyNamed(() => import("./pages/DividendCompoundPage"), "DividendCompoundPage");
const DividendIntelligencePage = lazyNamed(() => import("./pages/DividendIntelligencePage"), "DividendIntelligencePage");
const DividendPage = lazyNamed(() => import("./pages/DividendPage"), "DividendPage");
const Home = lazyNamed(() => import("./pages/Home"), "Home");
const LandingPage = lazyNamed(() => import("./pages/LandingPage"), "LandingPage");
const LoginPage = lazyNamed(() => import("./pages/LoginPage"), "LoginPage");
const ForgotPasswordPage = lazyNamed(() => import("./pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(() => import("./pages/ResetPasswordPage"), "ResetPasswordPage");
const HelpPage = lazyNamed(() => import("./pages/HelpPage"), "HelpPage");
const LossStreakPage = lazyNamed(() => import("./pages/LossStreakPage"), "LossStreakPage");
const MistakeLibraryPage = lazyNamed(() => import("./pages/MistakeLibraryPage"), "MistakeLibraryPage");
const PsycheProfilePage = lazyNamed(() => import("./pages/PsycheProfilePage"), "PsycheProfilePage");
const PaperTradingPage = lazyNamed(() => import("./pages/PaperTradingPage"), "PaperTradingPage");
const PositionSizePage = lazyNamed(() => import("./pages/PositionSizePage"), "PositionSizePage");
const PreMortemPage = lazyNamed(() => import("./pages/PreMortemPage"), "PreMortemPage");
const ReverseScreenerPage = lazyNamed(() => import("./pages/ReverseScreenerPage"), "ReverseScreenerPage");
const ReplayModePage = lazyNamed(() => import("./pages/ReplayModePage"), "ReplayModePage");
const StrategyDnaPage = lazyNamed(() => import("./pages/StrategyDnaPage"), "StrategyDnaPage");
const TrackRecordPage = lazyNamed(() => import("./pages/TrackRecordPage"), "TrackRecordPage");
const CrowdWisdomPage = lazyNamed(() => import("./pages/CrowdWisdomPage"), "CrowdWisdomPage");
const GlossaryPage = lazyNamed(() => import("./pages/GlossaryPage"), "GlossaryPage");
const DigestPage = lazyNamed(() => import("./pages/DigestPage"), "DigestPage");
const SkillTreePage = lazyNamed(() => import("./pages/SkillTreePage"), "SkillTreePage");
const EarningsPredictorPage = lazyNamed(() => import("./pages/EarningsPredictorPage"), "EarningsPredictorPage");
const InsiderMirrorPage = lazyNamed(() => import("./pages/InsiderMirrorPage"), "InsiderMirrorPage");
const NewsHalfLifePage = lazyNamed(() => import("./pages/NewsHalfLifePage"), "NewsHalfLifePage");
const SignalsPage = lazyNamed(() => import("./pages/SignalsPage"), "SignalsPage");
const StressTestPage = lazyNamed(() => import("./pages/StressTestPage"), "StressTestPage");
const SettingsPage = lazyNamed(() => import("./pages/SettingsPage"), "SettingsPage");
const MirrorTradingPage = lazyNamed(() => import("./pages/MirrorTradingPage"), "MirrorTradingPage");
const TaxOptimizerPage = lazyNamed(() => import("./pages/TaxOptimizerPage"), "TaxOptimizerPage");
const VolatilityPage = lazyNamed(() => import("./pages/VolatilityPage"), "VolatilityPage");
const BacktestPage = lazyNamed(() => import("./pages/BacktestPage"), "BacktestPage");
const RegisterPage = lazyNamed(() => import("./pages/RegisterPage"), "RegisterPage");
const AlpacaPage = lazyNamed(() => import("./pages/AlpacaPage"), "AlpacaPage");
const AdminAffiliatePage = lazyNamed(() => import("./pages/AdminAffiliatePage"), "AdminAffiliatePage");
const AdminPage = lazyNamed(() => import("./pages/AdminPage"), "AdminPage");
const OnboardingPage = lazyNamed(() => import("./pages/OnboardingPage"), "OnboardingPage");
const PremiumCompanyAnalysis = lazyNamed(() => import("./pages/PremiumCompanyAnalysis"), "PremiumCompanyAnalysis");
const WeeklyReviewPage = lazyNamed(() => import("./pages/WeeklyReviewPage"), "WeeklyReviewPage");
const VerifyEmailPage = lazyNamed(() => import("./pages/VerifyEmailPage"), "VerifyEmailPage");
const NotFoundPage = lazyNamed(() => import("./pages/NotFoundPage"), "NotFoundPage");
const ErrorPage = lazyNamed(() => import("./pages/ErrorPage"), "ErrorPage");
const PricingPage = lazyNamed(() => import("./pages/PricingPage"), "PricingPage");
const PaymentSuccessPage = lazyNamed(() => import("./pages/PaymentSuccessPage"), "PaymentSuccessPage");
const PaymentCancelPage = lazyNamed(() => import("./pages/PaymentCancelPage"), "PaymentCancelPage");
const ProfilePage = lazyNamed(() => import("./pages/ProfilePage"), "ProfilePage");
const PrivacyPage = lazyNamed(() => import("./pages/PrivacyPage"), "PrivacyPage");
const TermsPage = lazyNamed(() => import("./pages/TermsPage"), "TermsPage");
const WaitlistPage = lazyNamed(() => import("./pages/WaitlistPage"), "WaitlistPage");
const ChangelogPage = lazyNamed(() => import("./pages/ChangelogPage"), "ChangelogPage");
const ContactPage = lazyNamed(() => import("./pages/ContactPage"), "ContactPage");
const AboutPage = lazyNamed(() => import("./pages/AboutPage"), "AboutPage");
const ApiDocsPage = lazyNamed(() => import("./pages/ApiDocsPage"), "ApiDocsPage");

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  const onboardingCompleted = hasCompletedOnboarding();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!token) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (!onboardingCompleted && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function withPageErrorBoundary(page: string, children: ReactNode) {
  return <PageErrorBoundary page={page}>{children}</PageErrorBoundary>;
}

export default function App() {
  const { token } = useAuth();
  const location = useLocation();
  const [cookieConsent, setCookieConsent] = useState<CookieConsentType | null>(() => getCookieConsent());
  const onboardingCompleted = hasCompletedOnboarding();
  const defaultAuthenticatedRoute = onboardingCompleted ? "/dashboard" : "/onboarding";
  const inOnboarding = location.pathname.startsWith("/onboarding");
  const glassApp = Boolean(token) && !inOnboarding;
  const showTopNavigation = token && !inOnboarding;
  const showFloatingEmotionalWidget = token && !location.pathname.startsWith("/dashboard") && !inOnboarding;
  useKeyboardShortcuts();

  useEffect(() => {
    if (cookieConsent === "all") {
      initializeGA4();
    }
  }, [cookieConsent]);

  return (
    <div className={`app-shell min-h-screen ${glassApp ? "glass-app" : ""}`}>
      {glassApp ? <GlassAmbient /> : null}
      {showTopNavigation ? <AppNavBar glass /> : null}
      {showFloatingEmotionalWidget ? <EmotionalStateWidget /> : null}

      <main className={`relative z-10 ${token ? "pb-16 md:pb-0" : ""}`}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <LoginPage />} />
              <Route path="/register" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify" element={<VerifyEmailPage />} />
              <Route path="/payment-success" element={<PaymentSuccessPage />} />
              <Route path="/payment-cancel" element={<PaymentCancelPage />} />
              <Route
                path="/onboarding"
                element={token && onboardingCompleted ? <Navigate to="/dashboard" replace /> : <OnboardingPage />}
              />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="/error" element={<ErrorPage />} />

              <Route path="/" element={token ? <Navigate to={defaultAuthenticatedRoute} replace /> : <LandingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/waitlist" element={<WaitlistPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/api-docs" element={<ApiDocsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/companies" element={<Home />} />
              <Route path="/company/:symbol" element={<CompanyDetail />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/glossary" element={<GlossaryPage />} />
              <Route path="/track-record/public/:hash" element={<TrackRecordPage />} />

              <Route
                path="/dashboard"
                element={<ProtectedRoute>{withPageErrorBoundary("Dashboard", <Dashboard />)}</ProtectedRoute>}
              />
              <Route
                path="/paper-trading"
                element={<ProtectedRoute>{withPageErrorBoundary("PaperTradingPage", <PaperTradingPage />)}</ProtectedRoute>}
              />
              <Route
                path="/behavioral-coach"
                element={
                  <ProtectedRoute>{withPageErrorBoundary("BehavioralCoachPage", <BehavioralCoachPage />)}</ProtectedRoute>
                }
              />
              <Route path="/loss-streak" element={<ProtectedRoute><LossStreakPage /></ProtectedRoute>} />
              <Route path="/coach" element={<Navigate to="/behavioral-coach" replace />} />
              <Route path="/psyche-profile" element={<ProtectedRoute><PsycheProfilePage /></ProtectedRoute>} />
              <Route path="/weekly-review" element={<ProtectedRoute><WeeklyReviewPage /></ProtectedRoute>} />
              <Route path="/alpaca" element={<ProtectedRoute><AlpacaPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
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
              <Route path="/backtest" element={<ProtectedRoute><BacktestPage /></ProtectedRoute>} />
              <Route path="/earnings-predictor" element={<ProtectedRoute><EarningsPredictorPage /></ProtectedRoute>} />
              <Route path="/insider-mirror" element={<ProtectedRoute><InsiderMirrorPage /></ProtectedRoute>} />
              <Route path="/reverse-screener" element={<ProtectedRoute><ReverseScreenerPage /></ProtectedRoute>} />
              <Route path="/correlation" element={<ProtectedRoute><CorrelationPage /></ProtectedRoute>} />
              <Route path="/volatility" element={<ProtectedRoute><VolatilityPage /></ProtectedRoute>} />
              <Route path="/news-halflife" element={<ProtectedRoute><NewsHalfLifePage /></ProtectedRoute>} />
              <Route path="/crowd-wisdom" element={<ProtectedRoute><CrowdWisdomPage /></ProtectedRoute>} />
              <Route path="/dividend-compound" element={<ProtectedRoute><DividendCompoundPage /></ProtectedRoute>} />
              <Route path="/alpha-calendar" element={<ProtectedRoute><AlphaCalendarPage /></ProtectedRoute>} />
              <Route path="/alpha" element={<Navigate to="/alpha-calendar" replace />} />

              <Route path="/dividend" element={<DividendPage />} />
              <Route path="/dividend-screener" element={<DividendPage />} />
              <Route path="/dividend/intelligence" element={<ProtectedRoute><DividendIntelligencePage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminOnlyRoute><AdminPage /></AdminOnlyRoute></ProtectedRoute>} />
              <Route path="/admin/affiliate" element={<ProtectedRoute><AdminAffiliatePage /></ProtectedRoute>} />
              <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
              <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
              <Route
                path="/company/:symbol/premium"
                element={
                  <ProtectedRoute>
                    {withPageErrorBoundary("PremiumCompanyAnalysis", <PremiumCompanyAnalysis />)}
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {token ? <AppLegalFooter /> : null}
      {cookieConsent === null ? <CookieConsent onConsent={setCookieConsent} /> : null}
      {token ? <MobileBottomNav /> : null}
      <KeyboardShortcutsHelp />
    </div>
  );
}
