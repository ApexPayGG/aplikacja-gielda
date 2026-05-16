import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Screen1Verdict } from "../components/premium-analysis/Screen1Verdict";
import { Screen2PersonalFit } from "../components/premium-analysis/Screen2PersonalFit";
import { Screen3CinematicStory } from "../components/premium-analysis/Screen3CinematicStory";
import { Screen4HistoricalTwin } from "../components/premium-analysis/Screen4HistoricalTwin";
import { Screen5WhatsTheCatch } from "../components/premium-analysis/Screen5WhatsTheCatch";
import { ScreenNavigator } from "../components/premium-analysis/ScreenNavigator";
import { usePremiumAnalysisStore } from "../stores/premiumAnalysisStore";
import type {
  PremiumCatchResponse,
  PremiumPersonalFitResponse,
  PremiumStoryResponse,
  PremiumTwinsResponse,
  PremiumVerdictResponse,
} from "../services/api";
import { createStripeCheckoutSession } from "../services/api";
import { useAuth } from "../context/AuthContext";

type Tier = "FREE" | "PRO" | "PRO_PLUS";

function readTier(): Tier {
  if (typeof window === "undefined") return "FREE";
  const raw = (window.localStorage.getItem("userTier") || "FREE").toUpperCase();
  if (raw === "PRO_PLUS") return "PRO_PLUS";
  if (raw === "PRO") return "PRO";
  return "FREE";
}

function readUserId(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("userId");
  return raw && raw.trim() ? raw.trim() : "";
}

function monthBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getUsageLimit(tier: Tier): number {
  if (tier === "PRO_PLUS") return Number.POSITIVE_INFINITY;
  if (tier === "PRO") return 50;
  return 3;
}

function trackedTickersKey(userId: string, bucket: string): string {
  return `premium-usage-tickers:${userId}:${bucket}`;
}

function readTrackedTickers(key: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v).toUpperCase()) : [];
  } catch {
    return [];
  }
}

export function PremiumCompanyAnalysis() {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ticker = decodeURIComponent(symbol).toUpperCase();
  const [userTier] = useState<Tier>(() => readTier());
  const [userId] = useState<string>(() => readUserId());
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const {
    currentScreen,
    navigateToScreen,
    loadAnalysis,
    verdict,
    personalFit,
    story,
    twins,
    catchData,
    isLoading,
    errors,
    reset,
  } = usePremiumAnalysisStore();
  const typedVerdict = verdict as PremiumVerdictResponse | null;
  const typedPersonalFit = personalFit as PremiumPersonalFitResponse | null;
  const typedStory = story as PremiumStoryResponse | null;
  const typedTwins = twins as PremiumTwinsResponse | null;
  const typedCatch = catchData as PremiumCatchResponse | null;

  const lockedFrom = useMemo(() => {
    if (userTier === "PRO_PLUS") return undefined;
    if (userTier === "PRO") return 5;
    return 2;
  }, [userTier]);
  const usageLimit = useMemo(() => getUsageLimit(userTier), [userTier]);
  const overLimit = Number.isFinite(usageLimit) ? monthlyCount >= usageLimit : false;

  useEffect(() => {
    if (!ticker) return;
    const bucket = monthBucket();
    const usageKey = `premium-usage:${userId}:${bucket}`;
    const tickersKey = trackedTickersKey(userId, bucket);
    const tracked = new Set(readTrackedTickers(tickersKey));
    const currentCount = Number.parseInt(window.localStorage.getItem(usageKey) ?? "0", 10);
    const normalizedCount = Number.isFinite(currentCount) ? currentCount : 0;

    if (!tracked.has(ticker)) {
      if (Number.isFinite(usageLimit) && normalizedCount >= usageLimit) {
        setMonthlyCount(normalizedCount);
      } else {
        tracked.add(ticker);
        const nextCount = normalizedCount + 1;
        window.localStorage.setItem(usageKey, String(nextCount));
        window.localStorage.setItem(tickersKey, JSON.stringify(Array.from(tracked)));
        setMonthlyCount(nextCount);
        void loadAnalysis(ticker, userId, "en");
      }
    } else {
      setMonthlyCount(normalizedCount);
      void loadAnalysis(ticker, userId, "en");
    }
    return () => {
      reset();
    };
  }, [loadAnalysis, reset, ticker, usageLimit, userId]);

  const isScreenLocked = lockedFrom != null && currentScreen >= lockedFrom;
  const showUpgradeBlock = overLimit || isScreenLocked;

  const handleUpgrade = async (): Promise<void> => {
    const currentUserId = user?.id ?? userId;
    if (!currentUserId) {
      navigate("/login");
      return;
    }
    setIsUpgrading(true);
    try {
      const { url } = await createStripeCheckoutSession({
        userId: currentUserId,
        plan: "pro",
        billing: "monthly",
      });
      window.location.href = url;
    } catch {
      setIsUpgrading(false);
    }
  };

  const currentScreenBody = (
    <>
      {currentScreen === 1 ? <Screen1Verdict data={typedVerdict} loading={isLoading.verdict} onNext={() => navigateToScreen(2)} /> : null}
      {currentScreen === 2 ? <Screen2PersonalFit data={typedPersonalFit} loading={isLoading.personalFit} /> : null}
      {currentScreen === 3 ? <Screen3CinematicStory data={typedStory} loading={isLoading.story} /> : null}
      {currentScreen === 4 ? <Screen4HistoricalTwin data={typedTwins} loading={isLoading.twins} /> : null}
      {currentScreen === 5 ? (
        <Screen5WhatsTheCatch
          data={typedCatch}
          loading={isLoading.catch}
          onPreMortem={() => {
            navigate(
              `/premortem?${new URLSearchParams({
                symbol: ticker,
                entry: String(typedVerdict?.prices?.current ?? 0),
                stopLoss: String(typedVerdict?.prices?.stopLoss ?? 0),
                takeProfit: String(typedVerdict?.prices?.target12m ?? 0),
                quantity: "1",
              }).toString()}`,
            );
          }}
          onMirrorTrade={() => {
            navigate("/mirror-trading");
          }}
        />
      ) : null}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link to={`/company/${encodeURIComponent(ticker)}`} className="text-sm text-accent-muted hover:underline">
          ← Back to company
        </Link>
        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
          Tier: {userTier}
        </span>
      </div>
      <h1 className="mb-2 text-3xl font-bold text-white">{ticker} Premium Analysis</h1>
      <p className="mb-5 text-sm text-slate-400">5-screen cinematic analysis experience.</p>
      <p className="mb-3 text-xs text-slate-500">
        Usage this month: {monthlyCount}/{Number.isFinite(usageLimit) ? usageLimit : "∞"}
      </p>

      <ScreenNavigator
        current={currentScreen}
        onChange={(n) => navigateToScreen(n)}
        max={5}
        lockedFrom={lockedFrom}
      />

      {Object.values(errors).some(Boolean) ? (
        <div className="mb-4 rounded-lg border border-brand-red/40 bg-brand-red/10 p-3 text-sm text-brand-red">
          {[errors.verdict, errors.personalFit, errors.story, errors.twins, errors.catch].filter(Boolean).join(" | ")}
        </div>
      ) : null}

      <div className={showUpgradeBlock ? "relative" : undefined}>
        {currentScreenBody}
        {showUpgradeBlock ? (
          <section className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-brand-amber/40 bg-slate-950/70 p-6 text-center backdrop-blur-sm">
            <div className="max-w-lg rounded-2xl border border-brand-amber/40 bg-brand-amber/10 p-6">
              <h2 className="text-xl font-semibold text-white">Unlock full premium analysis</h2>
              <p className="mt-2 text-sm text-slate-300">
                {overLimit
                  ? `Monthly limit reached for ${userTier}.`
                  : userTier === "FREE"
                    ? "Screen 1 is available on Free. Upgrade to Pro for Screens 2-4, and Pro+ for Screen 5."
                    : "Upgrade to Pro+ to unlock Screen 5 with Dirty Truth and auto-context Pre-Mortem."}
              </p>
              <button
                type="button"
                onClick={() => void handleUpgrade()}
                disabled={isUpgrading}
                className="mt-4 rounded-lg border border-brand-amber/50 bg-brand-amber/20 px-4 py-2 text-sm text-brand-amber"
              >
                {isUpgrading ? "Redirecting..." : "Upgrade to Pro"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
