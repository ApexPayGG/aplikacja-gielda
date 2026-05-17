import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { api, getBehavioralCooldown, type BehavioralCooldownResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";

type Bias = "CUTS_WINNERS_EARLY" | "HOLDS_LOSERS_TOO_LONG" | "OVERTRADING";

type CoachSnapshot = {
  userId: string;
  biases: Bias[];
  avgWinPct: number;
  avgLossPct: number;
  avgHoldingWinHours: number;
  avgHoldingLossHours: number;
  calculatedAt: string;
};

type CoachResponse = {
  snapshot: CoachSnapshot | null;
  aiDescription: string;
};

type SnapshotHistoryPoint = {
  date: string;
  avgWinPct: number;
  avgLossPct: number;
};

type RuleItem = {
  id: string;
  label: string;
  active: boolean;
};

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  status: "positive" | "negative";
  impact: string;
};

const MOCK_USER_ID = "mock-user";

function formatCountdown(unlocksAt: string, nowTs: number): string {
  const target = new Date(unlocksAt).getTime();
  if (!Number.isFinite(target)) return "00:00";
  const remainingMs = Math.max(0, target - nowTs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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

function isFallbackError(e: unknown): boolean {
  return axios.isAxiosError(e) && (!e.response || e.response.status === 404 || e.response.status >= 500);
}

function toFixedNum(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSyntheticHistory(snapshot: CoachSnapshot | null): SnapshotHistoryPoint[] {
  const baseWin = snapshot?.avgWinPct ?? 3.8;
  const baseLoss = snapshot?.avgLossPct ?? -3.2;
  return Array.from({ length: 10 }).map((_, idx) => {
    const date = new Date(Date.now() - (9 - idx) * 24 * 60 * 60 * 1000);
    const win = baseWin + Math.sin(idx / 2) * 0.7 + (idx - 4) * 0.04;
    const loss = baseLoss + Math.cos(idx / 2.3) * 0.5 - (idx - 4) * 0.03;
    return {
      date: `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`,
      avgWinPct: toFixedNum(win),
      avgLossPct: toFixedNum(loss),
    };
  });
}

function getGrowthScore(snapshot: CoachSnapshot | null): number {
  if (!snapshot) return 52;
  const biasPenalty = snapshot.biases.length * 8;
  const performance = (snapshot.avgWinPct - Math.abs(snapshot.avgLossPct)) * 5.5;
  const holdFactor = (snapshot.avgHoldingWinHours - snapshot.avgHoldingLossHours / 4) * 1.2;
  return Math.round(clamp(64 + performance + holdFactor - biasPenalty, 10, 99));
}

function getBiasImpact(bias: Bias, snapshot: CoachSnapshot | null): number {
  if (!snapshot) return 16;
  if (bias === "CUTS_WINNERS_EARLY") {
    const imbalance = snapshot.avgHoldingLossHours - snapshot.avgHoldingWinHours;
    return Math.round(clamp(12 + imbalance * 0.9, 5, 95));
  }
  if (bias === "HOLDS_LOSERS_TOO_LONG") {
    return Math.round(clamp(Math.abs(snapshot.avgLossPct) * 7, 5, 95));
  }
  return Math.round(clamp(18 + snapshot.biases.length * 9, 5, 95));
}

function getBiasDescription(bias: Bias, snapshot: CoachSnapshot | null, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (bias === "CUTS_WINNERS_EARLY") {
    return t("coach.biasCutsBody", {
      winHours: (snapshot?.avgHoldingWinHours ?? 0).toFixed(1),
      lossHours: (snapshot?.avgHoldingLossHours ?? 0).toFixed(1),
    });
  }
  if (bias === "HOLDS_LOSERS_TOO_LONG") {
    return t("coach.biasHoldsBody", {
      lossPct: (snapshot?.avgLossPct ?? 0).toFixed(2),
      lossHours: (snapshot?.avgHoldingLossHours ?? 0).toFixed(1),
    });
  }
  return t("coach.biasOverBody", { maxTrades: 3 });
}

function buildRules(biases: Bias[]): RuleItem[] {
  return [
    {
      id: "rule-hold-winners",
      label: "Trzymam zyskowne pozycje minimum 12h",
      active: !biases.includes("CUTS_WINNERS_EARLY"),
    },
    {
      id: "rule-max-trades",
      label: "Limit wejść dziennie: 3 setupy A+",
      active: !biases.includes("OVERTRADING"),
    },
    {
      id: "rule-cut-losses",
      label: "Ucinam stratę najpóźniej przy -2.5%",
      active: !biases.includes("HOLDS_LOSERS_TOO_LONG"),
    },
    {
      id: "rule-journal",
      label: "Po każdej sesji zapisuję jeden wniosek",
      active: true,
    },
  ];
}

function buildTimeline(history: SnapshotHistoryPoint[]): TimelineItem[] {
  return history.slice(-6).reverse().map((point, idx) => {
    const edge = point.avgWinPct + point.avgLossPct;
    const positive = edge >= 0;
    const titles = positive
      ? ["Zachowany plan wyjścia", "Dyscyplina na zyskownej pozycji", "Mniej impulsywnych wejść"]
      : ["Zbyt szybkie wyjście z trendu", "Brak konsekwencji w stop-loss", "Nadmierna liczba transakcji"];
    const title = titles[idx % titles.length];
    return {
      id: `${point.date}-${idx}`,
      date: point.date,
      title,
      status: positive ? "positive" : "negative",
      impact: `${positive ? "+" : "-"}${Math.abs(edge).toFixed(2)} pp`,
    };
  });
}

export function BehavioralCoachPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const USER_ID = user?.id ?? MOCK_USER_ID;
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [history, setHistory] = useState<SnapshotHistoryPoint[]>([]);
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
        const response = {
          snapshot: data.snapshot,
          aiDescription: String(data.aiDescription ?? ""),
        };
        setCoach(response);

        try {
          const histRes = await api.get<{ data?: SnapshotHistoryPoint[] }>(`/paper/coach/${encodeURIComponent(USER_ID)}/history`);
          const rows = Array.isArray(histRes.data?.data) ? histRes.data.data.slice(0, 10) : [];
          setHistory(rows.length > 0 ? rows : buildSyntheticHistory(response.snapshot));
        } catch {
          setHistory(buildSyntheticHistory(response.snapshot));
        }
      } catch (e) {
        if (cancelled) return;
        if (isFallbackError(e)) {
          setCoach(mockCoach);
          setHistory(buildSyntheticHistory(mockCoach.snapshot));
          setUsingMock(true);
        } else {
          setError(apiErrorMessage(e));
          setCoach(mockCoach);
          setHistory(buildSyntheticHistory(mockCoach.snapshot));
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
  }, []);

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
  }, []);

  const snapshot = coach?.snapshot ?? null;
  const biases = useMemo(() => snapshot?.biases ?? [], [snapshot?.biases]);
  const rules = useMemo(() => buildRules(biases), [biases]);
  const timeline = useMemo(() => buildTimeline(history), [history]);
  const growthScore = useMemo(() => getGrowthScore(snapshot), [snapshot]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Behavioral Coach</h1>
            <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
              Twój profil decyzji, biasów i zasad inwestycyjnych w design systemie AMC Energy.
            </p>
          </div>
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: usingMock ? "rgba(255, 174, 51, 0.2)" : colors.bgTertiary,
              color: usingMock ? colors.brandGold : colors.textSecondary,
            }}
          >
            {usingMock ? t("common.apiMockBadge") : t("common.apiLiveBadge")}
          </span>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            {t("cooldown.title")}
          </h2>
          {cooldown?.active ? (
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: colors.negative,
                backgroundColor: "rgba(229, 57, 53, 0.09)",
                color: colors.textPrimary,
              }}
            >
              <p className="font-medium">{cooldown.message}</p>
              {cooldown.unlocksAt ? (
                <p className="mt-2 text-sm">
                  {t("cooldown.unlocksIn")}{" "}
                  <span className="font-mono font-semibold">{formatCountdown(cooldown.unlocksAt, nowTs)}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: colors.positive,
                backgroundColor: "rgba(0, 168, 107, 0.1)",
                color: colors.positive,
              }}
            >
              {t("cooldown.inactive")}
            </div>
          )}
          {cooldownError ? (
            <p className="text-xs" style={{ color: colors.negative }}>
              {cooldownError}
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: colors.negative, color: colors.negative }}>
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: colors.border }}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`sk-stat-${idx}`}
                  className="h-16 animate-pulse rounded-xl"
                  style={{ backgroundColor: idx % 2 === 0 ? colors.bgSecondary : colors.bgTertiary }}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <div
                  className="flex h-56 w-56 flex-col items-center justify-center rounded-full text-white shadow-xl"
                  style={{ background: `linear-gradient(145deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                >
                  <span className="text-xs uppercase tracking-[0.2em] opacity-80">GrowthScore</span>
                  <span className="mt-2 text-5xl font-bold leading-none">{growthScore}</span>
                  <span className="mt-2 text-sm opacity-80">/ 100</span>
                </div>
              </div>

              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                <section className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
                  <h2 className="text-base font-semibold">Wykryte biasy</h2>
                  <div className="mt-4 space-y-3">
                    {biases.length === 0 ? (
                      <div
                        className="rounded-xl border p-3 text-sm"
                        style={{ borderColor: colors.positive, backgroundColor: "rgba(0, 168, 107, 0.09)", color: colors.positive }}
                      >
                        {t("coach.noBiases")} 🎯
                      </div>
                    ) : (
                      biases.map((bias) => (
                        <article key={bias} className="rounded-xl border p-3" style={{ borderColor: colors.border }}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm"
                                style={{ backgroundColor: "rgba(0, 201, 212, 0.16)", color: colors.brandCyan }}
                              >
                                {bias === "CUTS_WINNERS_EARLY" ? "✂" : bias === "HOLDS_LOSERS_TOO_LONG" ? "⏳" : "⚡"}
                              </span>
                              <h3 className="text-sm font-semibold">
                                {bias === "CUTS_WINNERS_EARLY"
                                  ? t("coach.cutsWinners")
                                  : bias === "HOLDS_LOSERS_TOO_LONG"
                                    ? t("coach.holdsLosers")
                                    : t("coach.overtrading")}
                              </h3>
                            </div>
                            <span className="text-xs font-semibold" style={{ color: colors.textSecondary }}>
                              impact {getBiasImpact(bias, snapshot)}%
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {getBiasDescription(bias, snapshot, t)}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
                  <h2 className="text-base font-semibold">Twoje zasady</h2>
                  <ul className="mt-4 space-y-3">
                    {rules.map((rule) => (
                      <li key={rule.id}>
                        <label
                          className="flex cursor-default items-center gap-3 rounded-xl border px-3 py-2"
                          style={{
                            borderColor: rule.active ? colors.brandDark : colors.border,
                            backgroundColor: rule.active ? "rgba(45, 10, 107, 0.08)" : colors.bgPrimary,
                          }}
                        >
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold"
                            style={{
                              borderColor: rule.active ? colors.brandDark : colors.borderStrong,
                              color: rule.active ? colors.brandDark : colors.textMuted,
                              backgroundColor: rule.active ? "rgba(45, 10, 107, 0.08)" : colors.bgSecondary,
                            }}
                          >
                            {rule.active ? "✓" : ""}
                          </span>
                          <span style={{ color: rule.active ? colors.brandDark : colors.textSecondary }}>{rule.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
                  <h2 className="text-base font-semibold">Historia decyzji</h2>
                  <ol className="mt-4 space-y-4">
                    {timeline.map((item) => (
                      <li key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className="mt-1 h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.status === "positive" ? colors.positive : colors.negative }}
                          />
                          <span className="mt-1 h-full w-px" style={{ backgroundColor: colors.border }} />
                        </div>
                        <div className="pb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                            {item.date}
                          </p>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: item.status === "positive" ? colors.positive : colors.negative }}
                          >
                            {item.impact}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <div
                className="mt-6 rounded-2xl p-5 text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})` }}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/80">{t("coach.aiCoach")}</p>
                <p className="mt-3 text-lg leading-7">
                  “{coach?.aiDescription?.trim() ? coach.aiDescription : t("coach.aiDescriptionEmpty")}”
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  Zapisz plan działania
                </button>
                <button
                  type="button"
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  Odśwież analizę AI
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
