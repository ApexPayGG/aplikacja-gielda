import { SparklesIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import { BrokerIntegrationPaywall } from "../components/behavioral-coach/BrokerIntegrationPaywall";
import { CoachEmotionHubSection } from "../components/behavioral-coach/CoachEmotionHubSection";
import { CoachInterventionsSection } from "../components/behavioral-coach/CoachInterventionsSection";
import { CoachPaperTradingCard } from "../components/behavioral-coach/CoachPaperTradingCard";
import { EmotionJournalSection } from "../components/behavioral-coach/EmotionJournalSection";
import { TraderPsycheProfileSection } from "../components/behavioral-coach/TraderPsycheProfileSection";
import { useAuth } from "../context/AuthContext";
import { useCoachPaperTrading } from "../hooks/useCoachPaperTrading";
import { useEmotionSync } from "../hooks/useEmotionSync";
import { usePsycheSync } from "../hooks/usePsycheSync";
import type { SyncSource } from "../utils/psycheSync";
import { api, getBehavioralCooldown, type BehavioralCooldownResponse } from "../services/api";
import { buildCoachInterventions, type CoachSnapshotLike } from "../utils/behavioralCoachData";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { isFreePlan } from "../utils/subscriptionTier";

type CoachSnapshot = CoachSnapshotLike & {
  userId: string;
  calculatedAt: string;
};

type CoachResponse = {
  snapshot: CoachSnapshot | null;
  aiDescription: string;
};

const MOCK_USER_ID = "mock-user";

const mockCoach: CoachResponse = {
  snapshot: {
    userId: MOCK_USER_ID,
    biases: ["CUTS_WINNERS_EARLY", "OVERTRADING"],
    avgWinPct: 4.2,
    avgLossPct: -3.6,
    avgHoldingWinHours: 6.8,
    avgHoldingLossHours: 29.4,
    calculatedAt: new Date().toISOString(),
  },
  aiDescription: "",
};

function formatCountdown(unlocksAt: string, nowTs: number): string {
  const target = new Date(unlocksAt).getTime();
  if (!Number.isFinite(target)) return "00:00";
  const remainingMs = Math.max(0, target - nowTs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isFallbackError(e: unknown): boolean {
  return axios.isAxiosError(e) && (!e.response || e.response.status === 404 || e.response.status >= 500);
}

const MOCK_AI_KEY = "coach.mockAiDescription";

export function BehavioralCoachPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const USER_ID = user?.id ?? MOCK_USER_ID;
  const syncUserId = user?.id ?? null;
  const showBrokerPaywall = isFreePlan(user?.tier);

  const psycheSync = usePsycheSync(syncUserId);
  const emotionSync = useEmotionSync(syncUserId);
  const behavioralSyncSource: SyncSource =
    syncUserId && psycheSync.syncSource === "api" && emotionSync.syncSource === "api" ? "api" : "local";

  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [cooldown, setCooldown] = useState<BehavioralCooldownResponse | null>(null);
  const [cooldownError, setCooldownError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const snapshot = coach?.snapshot ?? null;

  const {
    hydrated,
    emotion,
    emotionAcknowledged,
    selectEmotion,
    psycheMetrics,
    openTrades,
    closedTrades,
    openPaperTrade,
    closePaperTrade,
    logJournalEntry,
  } = useCoachPaperTrading(USER_ID, snapshot, {
    psyche: syncUserId
      ? {
          storedScores: psycheSync.storedScores,
          saveStoredScores: psycheSync.saveStoredScores,
          psycheHydrated: !psycheSync.loading,
        }
      : undefined,
    emotion: syncUserId ? { logEmotion: emotionSync.logEmotion } : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadCoach(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<CoachResponse>(`/paper/coach/${encodeURIComponent(USER_ID)}`);
        if (cancelled) return;
        setCoach({
          snapshot: data.snapshot,
          aiDescription: String(data.aiDescription ?? ""),
        });
        setUsingMock(false);
      } catch (e) {
        if (cancelled) return;
        if (isFallbackError(e)) {
          setCoach({
            ...mockCoach,
            aiDescription: t(MOCK_AI_KEY, {
              defaultValue:
                "You have solid momentum potential, but you tend to close winners too early. Let trends run longer and limit daily entries to your highest-quality setups.",
            }),
          });
          setUsingMock(true);
        } else {
          setError(apiErrorMessage(e));
          setCoach({
            ...mockCoach,
            aiDescription: t(MOCK_AI_KEY, {
              defaultValue:
                "You have solid momentum potential, but you tend to close winners too early. Let trends run longer and limit daily entries to your highest-quality setups.",
            }),
          });
          setUsingMock(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCoach();
    return () => {
      cancelled = true;
    };
  }, [USER_ID, t]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCooldown(): Promise<void> {
      try {
        const data = await getBehavioralCooldown(USER_ID);
        if (cancelled) return;
        setCooldown(data);
        setCooldownError(null);
      } catch (e) {
        if (cancelled) return;
        setCooldownError(apiErrorMessage(e));
      }
    }
    void loadCooldown();
    const poll = setInterval(() => {
      void loadCooldown();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [USER_ID]);

  const interventions = useMemo(() => buildCoachInterventions(snapshot), [snapshot]);
  const radarLoading = loading || !hydrated || psycheSync.loading;

  return (
    <div className="relative overflow-x-hidden">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22d3ee]">StockAI Coach</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Behavioral Coach</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
              {t("coach.subtitle", {
                defaultValue: "Spot FOMO, revenge trading, and overtrading before they cost you real capital.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                usingMock
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                  : "border-white/15 bg-[#1e1b4b]/20 text-white/70"
              }`}
            >
              {usingMock ? t("common.apiMockBadge") : t("common.apiLiveBadge")}
            </span>
            {syncUserId ? (
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                  behavioralSyncSource === "api"
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/65"
                }`}
              >
                {behavioralSyncSource === "api"
                  ? `☁️ ${t("coach.synced", { defaultValue: "Synced" })}`
                  : `📱 ${t("coach.offline", { defaultValue: "Offline mode" })}`}
              </span>
            ) : null}
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#1e1b4b]/10 p-4 backdrop-blur-md">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">{t("cooldown.title")}</h2>
          {cooldown?.active ? (
            <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              <p className="font-medium">{cooldown.message}</p>
              {cooldown.unlocksAt ? (
                <p className="mt-2 text-red-200/80">
                  {t("cooldown.unlocksIn")}{" "}
                  <span className="font-mono font-semibold text-white">{formatCountdown(cooldown.unlocksAt, nowTs)}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {t("cooldown.inactive")}
            </p>
          )}
          {cooldownError ? <p className="mt-2 text-xs text-red-300">{cooldownError}</p> : null}
        </section>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}

        <TraderPsycheProfileSection
          metrics={psycheMetrics}
          growthScore={psycheSync.psycheData.growthScore}
          history={psycheSync.history}
          loading={radarLoading}
        />

        <CoachEmotionHubSection
          emotion={emotion}
          emotionAcknowledged={emotionAcknowledged}
          onSelectEmotion={selectEmotion}
        />

        <CoachPaperTradingCard
          emotion={emotion}
          emotionAcknowledged={emotionAcknowledged}
          openTrades={openTrades}
          closedTrades={closedTrades}
          onOpenTrade={openPaperTrade}
          onCloseTrade={closePaperTrade}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CoachInterventionsSection interventions={interventions} loading={loading} />
          <EmotionJournalSection
            emotion={emotion}
            emotionAcknowledged={emotionAcknowledged}
            entries={emotionSync.entries}
            entriesLoading={emotionSync.loading}
            onLogEntry={logJournalEntry}
          />
        </div>

        {showBrokerPaywall ? <BrokerIntegrationPaywall /> : null}

        {!loading && coach?.aiDescription?.trim() ? (
          <section className="rounded-2xl border border-[#22d3ee]/20 bg-gradient-to-br from-[#a855f7]/30 to-[#22d3ee]/10 p-5 backdrop-blur-md">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#22d3ee]">
              <SparklesIcon className="h-4 w-4" aria-hidden />
              {t("coach.aiCoach")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-white/90">“{coach.aiDescription}”</p>
          </section>
        ) : null}

        <InvestmentDisclaimer variant="drawer" />
      </div>
    </div>
  );
}
