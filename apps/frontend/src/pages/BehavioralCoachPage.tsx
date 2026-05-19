import { SparklesIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrokerIntegrationPaywall } from "../components/behavioral-coach/BrokerIntegrationPaywall";
import { CoachInterventionsSection } from "../components/behavioral-coach/CoachInterventionsSection";
import { EmotionJournalSection } from "../components/behavioral-coach/EmotionJournalSection";
import { GLASS_PAGE_BG } from "../components/behavioral-coach/glassStyles";
import { TraderPsycheProfileSection } from "../components/behavioral-coach/TraderPsycheProfileSection";
import { useAuth } from "../context/AuthContext";
import { api, getBehavioralCooldown, type BehavioralCooldownResponse } from "../services/api";
import {
  buildCoachInterventions,
  buildPsycheRadarMetrics,
  type CoachSnapshotLike,
} from "../utils/behavioralCoachData";
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
  aiDescription:
    "Masz dobry potencjał momentum, ale statystycznie zbyt szybko zamykasz zwycięzców. Pozwól trendom pracować dłużej i ogranicz liczbę wejść w ciągu dnia do setupów o najwyższej jakości.",
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

export function BehavioralCoachPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const USER_ID = user?.id ?? MOCK_USER_ID;
  const showBrokerPaywall = isFreePlan(user?.tier);

  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [cooldown, setCooldown] = useState<BehavioralCooldownResponse | null>(null);
  const [cooldownError, setCooldownError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

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
          setCoach(mockCoach);
          setUsingMock(true);
        } else {
          setError(apiErrorMessage(e));
          setCoach(mockCoach);
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
  }, [USER_ID]);

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

  const snapshot = coach?.snapshot ?? null;
  const psycheMetrics = useMemo(() => buildPsycheRadarMetrics(snapshot), [snapshot]);
  const interventions = useMemo(() => buildCoachInterventions(snapshot), [snapshot]);

  return (
    <div className={GLASS_PAGE_BG}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#2D0A6B]/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#00C9D4]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C9D4]">StockAI Coach</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Behavioral Coach</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
              Identyfikuj FOMO, revenge trading i overtrading — zanim kosztują Cię realny kapitał.
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
              usingMock
                ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                : "border-white/15 bg-[#2D0A6B]/20 text-white/70"
            }`}
          >
            {usingMock ? t("common.apiMockBadge") : t("common.apiLiveBadge")}
          </span>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#2D0A6B]/10 p-4 backdrop-blur-md">
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

        <TraderPsycheProfileSection metrics={psycheMetrics} loading={loading} />

        <div className="grid gap-6 lg:grid-cols-2">
          <CoachInterventionsSection interventions={interventions} loading={loading} />
          <EmotionJournalSection userId={USER_ID} />
        </div>

        {showBrokerPaywall ? <BrokerIntegrationPaywall /> : null}

        {!loading && coach?.aiDescription?.trim() ? (
          <section className="rounded-2xl border border-[#00C9D4]/20 bg-gradient-to-br from-[#2D0A6B]/30 to-[#00C9D4]/10 p-5 backdrop-blur-md">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#00C9D4]">
              <SparklesIcon className="h-4 w-4" aria-hidden />
              {t("coach.aiCoach")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-white/90">“{coach.aiDescription}”</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
