import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isPremiumAnalysisV2Enabled } from "../config/featureFlags";
import { PremiumCompanyAnalysisV2 } from "./PremiumCompanyAnalysisV2";
import { usePremiumAnalysisStore } from "../stores/premiumAnalysisStore";
import type {
  PremiumCatchResponse,
  PremiumPersonalFitResponse,
  PremiumStoryResponse,
  PremiumTwinsResponse,
  PremiumVerdictResponse,
} from "../services/api";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import { createStripeCheckoutSession } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";
import { normalizeUserPlan } from "../utils/subscriptionTier";

type Tier = "FREE" | "PRO" | "PRO_PLUS";

const SCREEN_COUNT = 5;

function formatTierLabel(tier: Tier): string {
  return tier === "PRO_PLUS" ? "PRO+" : tier;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatUsd(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyValue(entry)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${stringifyValue(entry)}`)
      .filter((entry) => !entry.endsWith(": "))
      .join(" • ");
  }
  return "";
}

function isQuoteOnlyVerdict(verdict: PremiumVerdictResponse | null): boolean {
  if (!verdict?.components || typeof verdict.components !== "object") return false;
  const comps = verdict.components as Record<string, { raw?: { mode?: string } }>;
  return Object.values(comps).some((entry) => entry?.raw?.mode === "fallback_quote_only");
}

function resolveVerdict(score: number, label: string | undefined): "BULL" | "BEAR" | "NEUTRAL" {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("bear") || normalized.includes("sell") || score <= 35) return "BEAR";
  if (normalized.includes("bull") || normalized.includes("buy") || score >= 65) return "BULL";
  return "NEUTRAL";
}

function toPremiumTier(tier: string | null | undefined): Tier {
  const plan = normalizeUserPlan(tier);
  if (plan === "PRO+") return "PRO_PLUS";
  if (plan === "PRO") return "PRO";
  return "FREE";
}

function monthBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getUsageLimit(tier: Tier): number {
  if (tier === "PRO_PLUS" || tier === "PRO") return Number.POSITIVE_INFINITY;
  return 10;
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
  const [forceLegacy, setForceLegacy] = useState(false);
  const v2Enabled = isPremiumAnalysisV2Enabled();

  if (v2Enabled && !forceLegacy) {
    return <PremiumCompanyAnalysisV2 onUseLegacy={() => setForceLegacy(true)} />;
  }

  return <PremiumCompanyAnalysisLegacy forceLegacyNotice={forceLegacy} />;
}

function PremiumCompanyAnalysisLegacy({ forceLegacyNotice = false }: { forceLegacyNotice?: boolean }) {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const ticker = decodeURIComponent(symbol).toUpperCase();
  const userId = user?.id ?? "";
  const userTier = useMemo(() => toPremiumTier(user?.tier), [user?.tier]);
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
  const quoteOnlyLimited = useMemo(() => isQuoteOnlyVerdict(typedVerdict), [typedVerdict]);
  const typedPersonalFit = personalFit as PremiumPersonalFitResponse | null;
  const typedStory = story as PremiumStoryResponse | null;
  const typedTwins = twins as PremiumTwinsResponse | null;
  const typedCatch = catchData as PremiumCatchResponse | null;

  const lockedFrom = useMemo(() => {
    if (isAuthLoading) return undefined;
    if (userTier === "PRO_PLUS") return undefined;
    if (userTier === "PRO") return 5;
    return 2;
  }, [isAuthLoading, userTier]);
  const usageLimit = useMemo(() => getUsageLimit(userTier), [userTier]);
  const overLimit = Number.isFinite(usageLimit) ? monthlyCount >= usageLimit : false;

  useEffect(() => {
    if (!ticker || isAuthLoading) return;
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
  }, [isAuthLoading, loadAnalysis, reset, ticker, usageLimit, userId]);

  useEffect(() => {
    if (!ticker) return;
    trackEvent("premium_analysis_view", { symbol: ticker });
  }, [ticker]);

  const isScreenLocked = !isAuthLoading && lockedFrom != null && currentScreen >= lockedFrom;
  const showUpgradeBlock = !isAuthLoading && (overLimit || isScreenLocked);

  const verdictTone = useMemo(
    () => resolveVerdict(typedVerdict?.score ?? 50, typedVerdict?.label),
    [typedVerdict?.label, typedVerdict?.score],
  );

  const storyActs = useMemo(() => {
    const byAct = new Map<number, PremiumStoryResponse["acts"][number]>();
    (typedStory?.acts ?? []).forEach((act) => {
      byAct.set(act.act, act);
    });
    return [1, 2, 3].map((actNumber) => byAct.get(actNumber) ?? (typedStory?.acts ?? [])[actNumber - 1] ?? null);
  }, [typedStory]);

  const dirtyTruthPoints = useMemo(() => {
    const points: string[] = [];
    if (typedCatch?.dirty_truth?.one_liner) points.push(typedCatch.dirty_truth.one_liner);
    if (typedCatch?.dirty_truth?.details) points.push(typedCatch.dirty_truth.details);
    if (typedCatch?.dirty_truth?.category) points.push(`Category: ${typedCatch.dirty_truth.category}`);
    if (typedCatch?.dirty_truth?.severity) points.push(`Severity: ${typedCatch.dirty_truth.severity.toUpperCase()}`);
    for (const prompt of typedCatch?.pre_mortem_context?.auto_filled_prompts ?? []) {
      points.push(prompt);
    }
    for (const action of typedCatch?.final_actions ?? []) {
      const asText = stringifyValue(action);
      if (asText) points.push(asText);
    }
    return points;
  }, [typedCatch]);

  const handleUpgrade = async (): Promise<void> => {
    const currentUserId = user?.id ?? userId;
    if (!currentUserId) {
      navigate("/login");
      return;
    }
    setIsUpgrading(true);
    try {
      trackEvent("begin_checkout", { plan: "pro", billing: "monthly" });
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
    <article
      className="rounded-3xl border p-6 md:p-8"
      style={{
        backgroundColor: colors.bgPrimary,
        borderColor: colors.border,
        boxShadow: "0 18px 44px rgba(168,85,247, 0.16)",
      }}
    >
      {currentScreen === 1 ? (
        <section className="space-y-6">
          <header>
            <h2 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              Screen 1 — Verdict
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              AI summary for {ticker}
            </p>
          </header>
          {isLoading.verdict ? (
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Loading verdict...
            </p>
          ) : !typedVerdict ? (
            <p className="text-sm" style={{ color: colors.negative }}>
              Verdict unavailable.
            </p>
          ) : (
            <div className="space-y-4">
              {quoteOnlyLimited ? (
                <p
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
                  role="status"
                >
                  Limited data — quote-only analysis. / Ograniczone dane — analiza tylko na podstawie
                  notowań.
                </p>
              ) : null}
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div className="flex justify-center">
                <div
                  className="relative flex h-56 w-56 items-center justify-center rounded-full p-4"
                  style={{ background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  <div
                    className="flex h-full w-full flex-col items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textSecondary }}>
                      AI Score
                    </p>
                    <p className="text-6xl font-bold leading-none" style={{ color: colors.brandDark }}>
                      {clamp(Math.round(typedVerdict.score), 0, 100)}
                    </p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: colors.textSecondary }}>
                      /100
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <span
                  className="inline-flex rounded-full px-4 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      verdictTone === "BULL"
                        ? "rgba(0, 168, 107, 0.14)"
                        : verdictTone === "BEAR"
                          ? "rgba(229, 57, 53, 0.14)"
                          : colors.bgTertiary,
                    color:
                      verdictTone === "BULL"
                        ? colors.positive
                        : verdictTone === "BEAR"
                          ? colors.negative
                          : colors.textSecondary,
                  }}
                >
                  {verdictTone} VERDICT
                </span>
                <h3 className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                  {typedVerdict.label}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                    Entry: {formatUsd(typedVerdict.prices.entryLow)} — {formatUsd(typedVerdict.prices.entryHigh)}
                  </p>
                  <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                    Target 12M: {formatUsd(typedVerdict.prices.target12m)}
                  </p>
                  <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                    Stop Loss: {formatUsd(typedVerdict.prices.stopLoss)}
                  </p>
                  <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
                    R/R Ratio: {typedVerdict.prices.riskReward.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToScreen(2)}
                  className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(90deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  Continue to Personal Fit
                </button>
              </div>
            </div>
            </div>
          )}
        </section>
      ) : null}

      {currentScreen === 2 ? (
        <section className="space-y-5">
          <header>
            <h2 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              Screen 2 — Personal Fit
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Match profile measured against your investor style.
            </p>
          </header>
          {isLoading.personalFit ? (
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Loading personal fit...
            </p>
          ) : !typedPersonalFit ? (
            <p className="text-sm" style={{ color: colors.negative }}>
              Personal fit unavailable.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: "Market Score", value: typedPersonalFit.marketScore },
                  { label: "Personal Score", value: typedPersonalFit.personalScore },
                  { label: "Delta", value: typedPersonalFit.delta },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border px-4 py-3"
                    style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                  >
                    <p className="text-xs uppercase tracking-[0.12em]" style={{ color: colors.textSecondary }}>
                      {metric.label}
                    </p>
                    <p className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {typedPersonalFit.matches.map((item) => {
                  const max = item.max || 1;
                  const progress = clamp((item.score / max) * 100, 0, 100);
                  return (
                    <div key={`${item.dimension}-${item.value}`}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span style={{ color: colors.textPrimary }}>{item.dimension}</span>
                        <span style={{ color: colors.textSecondary }}>
                          {item.score}/{item.max}
                        </span>
                      </div>
                      <div className="h-3 rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progress}%`, backgroundColor: colors.brandCyan }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      {currentScreen === 3 ? (
        <section className="space-y-5">
          <header>
            <h2 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              Screen 3 — Story
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Three-act narrative for the investment thesis.
            </p>
          </header>
          {isLoading.story ? (
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Building the story...
            </p>
          ) : !typedStory ? (
            <p className="text-sm" style={{ color: colors.negative }}>
              Story unavailable.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {storyActs.map((act, index) => (
                <article
                  key={`act-${index + 1}`}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: colors.brandDark }}
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-base font-semibold" style={{ color: colors.brandDark }}>
                      {act?.title ?? `Act ${index + 1}`}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
                    {act?.narrative ?? "Narrative is not available yet for this act."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {currentScreen === 4 ? (
        <section className="space-y-5">
          <header>
            <h2 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              Screen 4 — Historical Twin
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Similar historical setups and their outcomes.
            </p>
          </header>
          {isLoading.twins ? (
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Loading twins...
            </p>
          ) : !typedTwins ? (
            <p className="text-sm" style={{ color: colors.negative }}>
              Historical twins unavailable.
            </p>
          ) : (
            <ul className="space-y-3">
              {typedTwins.twins.map((twin) => (
                <li
                  key={`${twin.ticker}-${twin.date_of_match}`}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold" style={{ color: colors.brandDark }}>
                        {twin.ticker}
                      </p>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>
                        Match date: {new Date(twin.date_of_match).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: colors.bgTertiary, color: colors.brandDark }}
                    >
                      Similarity {Math.round(clamp(twin.match_score, 0, 1) * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {twin.lesson}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {currentScreen === 5 ? (
        <section className="space-y-5">
          <header>
            <h2 className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              Screen 5 — Dirty Truth
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Critical risk signals before taking action.
            </p>
          </header>
          {isLoading.catch ? (
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Loading dirty truth...
            </p>
          ) : !typedCatch ? (
            <p className="text-sm" style={{ color: colors.negative }}>
              Dirty truth unavailable.
            </p>
          ) : (
            <ul className="space-y-3">
              {(dirtyTruthPoints.length ? dirtyTruthPoints : ["No critical risks were identified by the model."]).map((point, idx) => (
                <li
                  key={`${point}-${idx}`}
                  className="flex items-start gap-3 rounded-xl border px-4 py-3"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
                >
                  <span style={{ color: colors.brandGold }}>⚠</span>
                  <span className="text-sm leading-relaxed" style={{ color: colors.textPrimary }}>
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </article>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to={`/company/${encodeURIComponent(ticker)}`} className="mb-4 inline-block text-sm hover:underline" style={{ color: colors.brandMedium }}>
          ← Back to company
        </Link>
        {forceLegacyNotice ? (
          <p
            className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
            role="status"
          >
            Premium Analysis V2 is unavailable in this session. Showing the legacy 5-screen flow.
          </p>
        ) : null}
        <header
          className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, boxShadow: "0 8px 24px rgba(168,85,247, 0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: colors.brandDark }}
            >
              {ticker.slice(0, 3)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em]" style={{ color: colors.textSecondary }}>
                {ticker}
              </p>
              <h1 className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                Premium Analysis
              </h1>
            </div>
          </div>
          <span className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: colors.brandDark }}>
            {isAuthLoading ? "..." : formatTierLabel(userTier)}
          </span>
        </header>

        <p className="mb-4 text-xs" style={{ color: colors.textSecondary }}>
          Usage this month: {monthlyCount}/{Number.isFinite(usageLimit) ? usageLimit : "∞"}
        </p>

        <nav className="mb-6 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: SCREEN_COUNT }, (_, idx) => idx + 1).map((screenNumber, idx) => {
            const locked = lockedFrom != null && screenNumber >= lockedFrom;
            const isActive = currentScreen === screenNumber;
            const isCompleted = screenNumber < currentScreen;
            return (
              <div key={screenNumber} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!locked) navigateToScreen(screenNumber);
                  }}
                  disabled={locked}
                  className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: isActive ? colors.brandDark : colors.borderStrong,
                    backgroundColor: isActive ? colors.brandDark : colors.bgPrimary,
                    color: isActive ? colors.bgPrimary : colors.textSecondary,
                  }}
                >
                  {screenNumber}
                </button>
                {idx < SCREEN_COUNT - 1 ? (
                  <span
                    className="h-[3px] w-8 rounded-full md:w-12"
                    style={{ backgroundColor: isCompleted ? colors.brandCyan : colors.borderStrong }}
                  />
                ) : null}
              </div>
            );
          })}
        </nav>

        {Object.values(errors).some(Boolean) ? (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(229, 57, 53, 0.3)", backgroundColor: "rgba(229, 57, 53, 0.08)", color: colors.negative }}>
            {[errors.verdict, errors.personalFit, errors.story, errors.twins, errors.catch].filter(Boolean).join(" | ")}
          </div>
        ) : null}

        <div className={showUpgradeBlock ? "relative" : undefined}>
          {currentScreenBody}
          {showUpgradeBlock ? (
            <section
              className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl p-6 text-center backdrop-blur-[3px]"
              style={{ background: `linear-gradient(135deg, rgba(168,85,247, 0.84), rgba(122, 15, 158, 0.76))` }}
            >
              <div className="max-w-xl rounded-2xl border p-7" style={{ borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.1)" }}>
                <h2 className="text-2xl font-semibold text-white">Unlock full premium analysis</h2>
                <p className="mt-2 text-sm text-white/90">
                  {overLimit
                    ? `Monthly limit reached for ${formatTierLabel(userTier)}.`
                    : userTier === "FREE"
                      ? "Screen 1 is available on Free. Upgrade to Pro for Screens 2-4, and Pro+ for Screen 5."
                      : "Upgrade to Pro+ to unlock Screen 5 with Dirty Truth and auto-context Pre-Mortem."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleUpgrade()}
                  disabled={isUpgrading}
                  className="mt-5 w-full rounded-xl px-6 py-3 text-base font-semibold text-white disabled:opacity-70"
                  style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  {isUpgrading ? "Redirecting..." : "Upgrade to Pro"}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <InvestmentDisclaimer className="mt-8" />
      </div>
    </div>
  );
}
