type GaugeTone = "red" | "yellow" | "green";

function toneForScore(score: number): GaugeTone {
  if (score < 33) return "red";
  if (score < 66) return "yellow";
  return "green";
}

const toneClasses: Record<GaugeTone, { bar: string; text: string }> = {
  red: { bar: "bg-red-500", text: "text-red-400" },
  yellow: { bar: "bg-amber-400", text: "text-amber-300" },
  green: { bar: "bg-emerald-500", text: "text-emerald-400" },
};

export interface DividendScoreCardProps {
  safetyScore: number;
  safetyReason: string;
}

/** Karta safety score: gauge 0–100 + uzasadnienie. */
export function DividendScoreCard({ safetyScore, safetyReason }: DividendScoreCardProps) {
  const clamped = Math.min(100, Math.max(0, safetyScore));
  const tone = toneForScore(clamped);
  const { bar, text } = toneClasses[tone];

  return (
    <section className="rounded-lg border border-surface-border bg-surface-elevated p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Safety score</h2>
      <div className="mt-4 flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${text}`}>{clamped}</span>
        <span className="pb-1 text-sm text-slate-500">/ 100</span>
      </div>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">{safetyReason}</p>
    </section>
  );
}
