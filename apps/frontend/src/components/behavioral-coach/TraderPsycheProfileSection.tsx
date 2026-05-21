import { SparklesIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import {
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PsycheRadarPoint } from "../../utils/behavioralCoachData";
import type { PsycheHistoryPoint } from "../../utils/psycheSync";
import { useCompactViewport } from "../../utils/useCompactViewport";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";
import { TraderProfileShareMenu } from "./TraderProfileShareMenu";

type Props = {
  metrics: PsycheRadarPoint[];
  growthScore?: number;
  history?: PsycheHistoryPoint[];
  loading?: boolean;
};

function MetricBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-mono font-semibold text-[#22d3ee]">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-[#1e1b4b]/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#a855f7] to-[#22d3ee]"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function TraderPsycheProfileSection({ metrics, growthScore, history = [], loading }: Props) {
  const isCompact = useCompactViewport();
  const averageScore = useMemo(() => {
    if (typeof growthScore === "number") return growthScore;
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((sum, row) => sum + row.score, 0) / metrics.length);
  }, [growthScore, metrics]);

  const historyChartData = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((row) => ({
          label: new Date(row.createdAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short" }),
          growth: row.growthScore,
        })),
    [history],
  );

  const radarOuterRadius = isCompact ? "58%" : "72%";
  const axisFontSize = isCompact ? 9 : 11;

  return (
    <section className={GLASS_SECTION}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={GLASS_SECTION_TITLE}>Twój Profil Psychiki Tradera</h2>
          <p className="mt-1 text-sm text-white/55">
            Metryki zsynchronizowane z paper tradingiem i dziennikiem emocji (TimescaleDB).
          </p>
        </div>
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#22d3ee]/25 bg-[#22d3ee]/10 px-3 py-1 text-xs font-medium text-[#22d3ee] sm:w-auto">
          <SparklesIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Indeks psychiki: {loading ? "—" : averageScore}/100
        </span>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse rounded-xl bg-white/5 sm:h-64" aria-hidden />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex w-full min-w-0 flex-col">
            <div className="h-56 w-full min-h-[14rem] shrink-0 sm:h-64 lg:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics} cx="50%" cy="50%" outerRadius={radarOuterRadius}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.75)", fontSize: axisFontSize }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <Radar
                  name="Wynik"
                  dataKey="score"
                  stroke="#22d3ee"
                  fill="#22d3ee"
                  fillOpacity={0.35}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(26, 5, 56, 0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  formatter={(value: number) => [`${value}/100`, "Wynik"]}
                />
              </RadarChart>
            </ResponsiveContainer>
            </div>
            <TraderProfileShareMenu metrics={metrics} disabled={loading} />
          </div>

          <div className="flex min-w-0 flex-col justify-center space-y-4">
            {metrics.map((row) => (
              <MetricBar key={row.metric} label={row.metric} score={row.score} />
            ))}
            {historyChartData.length > 1 ? (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Trend wzrostu (30 dni)</p>
                <div className="h-28 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData}>
                      <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={28} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(26, 5, 56, 0.95)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "12px",
                          color: "#fff",
                        }}
                      />
                      <Line type="monotone" dataKey="growth" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
