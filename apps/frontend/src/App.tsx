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
import { AccessBanner } from "./components/AccessBanner";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { useAuth } from "./context/AuthContext";
import { useUserAccess } from "./hooks/useUserAccess";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { initializeGA4, trackPageView } from "./utils/analytics";
import { getCookieConsent, type CookieConsentType } from "./utils/cookieConsent";
import { GlassAmbient } from "./components/behavioral-coach/GlassAmbient";
import { TerminalAppShell } from "./components/terminal";
import { isPublicShellRoute } from "./config/navConfig";
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
const AutopilotSettings = lazyNamed(() => import("./pages/AutopilotSettings"), "AutopilotSettings");
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

function ProductAccessRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { access, isLoading } = useUserAccess();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (user?.role === "ADMIN") {
    return <>{children}</>;
  }
  if (access && !access.canUseProduct) {
    return <Navigate to="/pricing" replace state={{ trialExpired: true }} />;
  }
  return <>{children}</>;
}

function ProtectedProductRoute({ children, page }: { children: ReactNode; page?: string }) {
  const content = page ? withPageErrorBoundary(page, children) : children;
  return (
    <ProtectedRoute>
      <ProductAccessRoute>{content}</ProductAccessRoute>
    </ProtectedRoute>
  );
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
  /** Dark glass theme on every route (landing, auth, onboarding, app). */
  const glassApp = true;
  const showTerminalShell =
    Boolean(token) && !inOnboarding && onboardingCompleted && !isPublicShellRoute(location.pathname);
  const showAppTopNav = Boolean(token) && !inOnboarding && !showTerminalShell;
  const showFloatingEmotionalWidget =
    token && !location.pathname.startsWith("/dashboard") && !inOnboarding && showTerminalShell;
  useKeyboardShortcuts();

  useEffect(() => {
    if (cookieConsent === "all") {
      initializeGA4();
    }
  }, [cookieConsent]);

  useEffect(() => {
    if (cookieConsent !== "all") return;
    trackPageView(`${location.pathname}${location.search}`, document.title);
  }, [cookieConsent, location.pathname, location.search]);

  const appRoutes = (
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
        element={<ProtectedProductRoute page="Dashboard"><Dashboard /></ProtectedProductRoute>}
      />
      <Route
        path="/paper-trading"
        element={<ProtectedProductRoute page="PaperTradingPage"><PaperTradingPage /></ProtectedProductRoute>}
      />
      <Route
        path="/behavioral-coach"
        element={<ProtectedProductRoute page="BehavioralCoachPage"><BehavioralCoachPage /></ProtectedProductRoute>}
      />
      <Route path="/loss-streak" element={<ProtectedProductRoute><LossStreakPage /></ProtectedProductRoute>} />
      <Route path="/coach" element={<Navigate to="/behavioral-coach" replace />} />
      <Route path="/psyche-profile" element={<ProtectedProductRoute><PsycheProfilePage /></ProtectedProductRoute>} />
      <Route path="/weekly-review" element={<ProtectedProductRoute><WeeklyReviewPage /></ProtectedProductRoute>} />
      <Route path="/alpaca" element={<ProtectedProductRoute><AlpacaPage /></ProtectedProductRoute>} />
      <Route path="/autopilot" element={<ProtectedProductRoute><AutopilotSettings /></ProtectedProductRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/mistake-library" element={<ProtectedProductRoute><MistakeLibraryPage /></ProtectedProductRoute>} />
      <Route path="/skill-tree" element={<ProtectedProductRoute><SkillTreePage /></ProtectedProductRoute>} />
      <Route path="/mirror-trading" element={<ProtectedProductRoute><MirrorTradingPage /></ProtectedProductRoute>} />
      <Route path="/digest" element={<ProtectedProductRoute><DigestPage /></ProtectedProductRoute>} />
      <Route path="/position-size" element={<ProtectedProductRoute><PositionSizePage /></ProtectedProductRoute>} />
      <Route path="/stress-test" element={<ProtectedProductRoute><StressTestPage /></ProtectedProductRoute>} />
      <Route path="/concentration" element={<ProtectedProductRoute><ConcentrationPage /></ProtectedProductRoute>} />
      <Route path="/tax-optimizer" element={<ProtectedProductRoute><TaxOptimizerPage /></ProtectedProductRoute>} />
      <Route path="/premortem" element={<ProtectedProductRoute><PreMortemPage /></ProtectedProductRoute>} />
      <Route path="/strategy-dna" element={<ProtectedProductRoute><StrategyDnaPage /></ProtectedProductRoute>} />
      <Route path="/track-record" element={<ProtectedProductRoute><TrackRecordPage /></ProtectedProductRoute>} />
      <Route path="/replay" element={<ProtectedProductRoute><ReplayModePage /></ProtectedProductRoute>} />
      <Route path="/backtest" element={<ProtectedProductRoute><BacktestPage /></ProtectedProductRoute>} />
      <Route path="/earnings-predictor" element={<ProtectedProductRoute><EarningsPredictorPage /></ProtectedProductRoute>} />
      <Route path="/insider-mirror" element={<ProtectedProductRoute><InsiderMirrorPage /></ProtectedProductRoute>} />
      <Route path="/reverse-screener" element={<ProtectedProductRoute><ReverseScreenerPage /></ProtectedProductRoute>} />
      <Route path="/correlation" element={<ProtectedProductRoute><CorrelationPage /></ProtectedProductRoute>} />
      <Route path="/volatility" element={<ProtectedProductRoute><VolatilityPage /></ProtectedProductRoute>} />
      <Route path="/news-halflife" element={<ProtectedProductRoute><NewsHalfLifePage /></ProtectedProductRoute>} />
      <Route path="/crowd-wisdom" element={<ProtectedProductRoute><CrowdWisdomPage /></ProtectedProductRoute>} />
      <Route path="/dividend-compound" element={<ProtectedProductRoute><DividendCompoundPage /></ProtectedProductRoute>} />
      <Route path="/alpha-calendar" element={<ProtectedProductRoute><AlphaCalendarPage /></ProtectedProductRoute>} />
      <Route path="/alpha" element={<Navigate to="/alpha-calendar" replace />} />

      <Route path="/dividend" element={<DividendPage />} />
      <Route path="/dividend-screener" element={<DividendPage />} />
      <Route path="/dividend/intelligence" element={<ProtectedProductRoute><DividendIntelligencePage /></ProtectedProductRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminOnlyRoute><AdminPage /></AdminOnlyRoute></ProtectedRoute>} />
      <Route
        path="/admin/affiliate"
        element={
          <ProtectedRoute>
            <AdminOnlyRoute>
              <AdminAffiliatePage />
            </AdminOnlyRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/dividends" element={<Navigate to="/dividend" replace />} />
      <Route path="/intelligence/dividends" element={<Navigate to="/dividend/intelligence" replace />} />
      <Route
        path="/company/:symbol/premium"
        element={
          <ProtectedProductRoute page="PremiumCompanyAnalysis">
            <PremiumCompanyAnalysis />
          </ProtectedProductRoute>
        }
      />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );

  return (
    <div className={`app-shell min-h-screen ${glassApp ? "glass-app" : ""}`}>
      {glassApp ? <GlassAmbient /> : null}
      {showAppTopNav ? <AppNavBar glass /> : null}
      {showAppTopNav ? <AccessBanner /> : null}
      {showFloatingEmotionalWidget ? <EmotionalStateWidget /> : null}

      <main className={`relative z-10 ${token && !showTerminalShell ? "pb-16 md:pb-0" : ""}`}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            {showTerminalShell ? (
              <TerminalAppShell banner={<AccessBanner />}>{appRoutes}</TerminalAppShell>
            ) : (
              appRoutes
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
      {token ? <AppLegalFooter /> : null}
      {cookieConsent === null ? <CookieConsent onConsent={setCookieConsent} /> : null}
      {token && !inOnboarding && !showTerminalShell ? <MobileBottomNav /> : null}
      <KeyboardShortcutsHelp />
    </div>
  );
}
