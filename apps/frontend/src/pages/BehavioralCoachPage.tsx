import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

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

const USER_ID = "demo-user";

const mockCoach: CoachResponse = {
  snapshot: {
    userId: USER_ID,
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

function StatBox(props: { label: string; value: string; colorClass: string }) {
  return (
    <div className="neo-panel rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{props.label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${props.colorClass}`}>{props.value}</div>
    </div>
  );
}

function BiasCard(props: { bias: Bias; avgWinHours: number; avgLossHours: number; avgLossPct: number }) {
  const { t } = useTranslation();
  if (props.bias === "CUTS_WINNERS_EARLY") {
    return (
      <div className="rounded-lg border border-orange-400/50 bg-orange-500/10 p-4">
        <h3 className="text-sm font-semibold text-orange-200">✂️ {t("coach.cutsWinners")}</h3>
        <p className="mt-2 text-sm text-slate-300">
          Zamykasz zyskowne pozycje średnio po <span className="font-mono">{props.avgWinHours.toFixed(1)} h</span>, ale trzymasz straty
          przez <span className="font-mono"> {props.avgLossHours.toFixed(1)} h</span>.
        </p>
      </div>
    );
  }
  if (props.bias === "HOLDS_LOSERS_TOO_LONG") {
    return (
      <div className="rounded-lg border border-brand-red/50 bg-brand-red/10 p-4">
        <h3 className="text-sm font-semibold text-[#ff9d9d]">⏳ {t("coach.holdsLosers")}</h3>
        <p className="mt-2 text-sm text-slate-300">
          Średnia strata: <span className="font-mono">{props.avgLossPct.toFixed(2)}%</span>, czas trzymania:{" "}
          <span className="font-mono">{props.avgLossHours.toFixed(1)} h</span>.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-yellow-400/50 bg-yellow-500/10 p-4">
      <h3 className="text-sm font-semibold text-yellow-200">⚡ {t("coach.overtrading")}</h3>
      <p className="mt-2 text-sm text-slate-300">Więcej niż 3 trades w ostatnich 24h.</p>
    </div>
  );
}

export function BehavioralCoachPage() {
  const { t } = useTranslation();
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [history, setHistory] = useState<SnapshotHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

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
          aiDescription: String(data.aiDescription ?? "Brak opisu AI coacha."),
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

  const snapshot = coach?.snapshot;
  const biases = useMemo(() => snapshot?.biases ?? [], [snapshot?.biases]);

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-white">{t("coach.traderProfile")}</h1>
          <span className={`rounded px-3 py-1 text-xs ${usingMock ? "bg-orange-500/20 text-orange-200" : "bg-slate-700/40 text-slate-300"}`}>
            {usingMock ? "Mock fallback active" : "Live API"}
          </span>
        </header>

        {error && <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</div>}

        <section className="neo-panel neo-panel-accent rounded-xl p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`sk-stat-${idx}`} className="h-16 animate-pulse rounded bg-slate-700/40" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <StatBox label={t("coach.avgWin")} value={`${snapshot?.avgWinPct.toFixed(2) ?? "0.00"}%`} colorClass="text-brand-green" />
                <StatBox label={t("coach.avgLoss")} value={`${snapshot?.avgLossPct.toFixed(2) ?? "0.00"}%`} colorClass="text-brand-red" />
                <StatBox
                  label={t("coach.avgHoldWin", { defaultValue: "Avg Hold Win" })}
                  value={`${snapshot?.avgHoldingWinHours.toFixed(1) ?? "0.0"} h`}
                  colorClass="text-brand-blue"
                />
                <StatBox
                  label={t("coach.avgHoldLoss", { defaultValue: "Avg Hold Loss" })}
                  value={`${snapshot?.avgHoldingLossHours.toFixed(1) ?? "0.0"} h`}
                  colorClass="text-orange-300"
                />
              </div>

              <div className="mt-5 space-y-3">
                {biases.length === 0 && (
                  <div className="rounded-lg border border-brand-green/50 bg-brand-green/10 p-4 text-brand-green">{t("coach.noBiases")} 🎯</div>
                )}
                {biases.map((bias) => (
                  <BiasCard
                    key={bias}
                    bias={bias}
                    avgWinHours={snapshot?.avgHoldingWinHours ?? 0}
                    avgLossHours={snapshot?.avgHoldingLossHours ?? 0}
                    avgLossPct={snapshot?.avgLossPct ?? 0}
                  />
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-brand-blue/35 bg-brand-blue/10 p-4">
                <h3 className="text-base font-semibold text-brand-blue">💬 {t("coach.aiCoach")}:</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {coach?.aiDescription ?? "Brak treści od AI Coacha."}
                </p>
              </div>
            </>
          )}
        </section>

        <section className="neo-panel rounded-xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">{t("paperTrading.history")}</h2>
          {loading ? (
            <div className="h-64 animate-pulse rounded bg-slate-700/35" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={history.slice(-10)}>
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0b1627",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                    }}
                  />
                  <Line type="monotone" dataKey="avgWinPct" stroke="rgb(0 200 122)" strokeWidth={2.5} dot={false} name="Avg Win %" />
                  <Line type="monotone" dataKey="avgLossPct" stroke="rgb(255 74 74)" strokeWidth={2.5} dot={false} name="Avg Loss %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
