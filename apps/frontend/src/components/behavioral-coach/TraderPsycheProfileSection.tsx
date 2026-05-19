import { SparklesIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PsycheRadarPoint } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";
import { TraderProfileShareMenu } from "./TraderProfileShareMenu";

type Props = {
  metrics: PsycheRadarPoint[];
  loading?: boolean;
};

function MetricBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-mono font-semibold text-[#00C9D4]">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-[#2D0A6B]/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2D0A6B] to-[#00C9D4]"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function TraderPsycheProfileSection({ metrics, loading }: Props) {
  const averageScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((sum, row) => sum + row.score, 0) / metrics.length);
  }, [metrics]);

  return (
    <section className={GLASS_SECTION}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={GLASS_SECTION_TITLE}>Twój Profil Psychiki Tradera</h2>
          <p className="mt-1 text-sm text-white/55">Metryki wyliczone z mockowej analizy transakcji paper trading.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00C9D4]/25 bg-[#00C9D4]/10 px-3 py-1 text-xs font-medium text-[#00C9D4]">
          <SparklesIcon className="h-3.5 w-3.5" aria-hidden />
          Indeks psychiki: {loading ? "—" : averageScore}/100
        </span>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-white/5" aria-hidden />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="flex w-full min-h-[320px] flex-col">
            <div className="h-72 w-full min-h-[240px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <Radar
                  name="Wynik"
                  dataKey="score"
                  stroke="#00C9D4"
                  fill="#00C9D4"
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

          <div className="flex flex-col justify-center space-y-4">
            {metrics.map((row) => (
              <MetricBar key={row.metric} label={row.metric} score={row.score} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
