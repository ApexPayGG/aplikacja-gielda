import { PersonalFitComparison } from "./PersonalFitComparison";

type PersonalFitData = {
  marketScore: number;
  personalScore: number;
  delta: number;
  matches: Array<{ dimension: string; value: string; score: number; max: number }>;
  mismatches: Array<{ dimension: string; severity: string; explanation: string; threshold?: string }>;
  suggestedActions?: Array<{ action?: string; reasoning?: string; targetPrice?: number; alternatives?: string[] }>;
};

type Props = {
  data: PersonalFitData | null;
  loading: boolean;
};

export function Screen2PersonalFit({ data, loading }: Props) {
  if (loading) return <div className="rounded-xl border border-surface-border bg-surface-elevated p-5 text-slate-400">Loading personal fit...</div>;
  if (!data) return <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-5 text-brand-red">Personal fit unavailable.</div>;

  return (
    <section className="space-y-4 rounded-2xl border border-surface-border bg-surface-elevated p-5">
      <h2 className="text-xl font-semibold text-white">Screen 2 - Personal Fit</h2>
      <PersonalFitComparison marketScore={data.marketScore} personalScore={data.personalScore} delta={data.delta} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase text-brand-green">What Fits</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.matches.map((item) => (
              <li key={item.dimension}>• {item.dimension}: {item.value} ({item.score}/{item.max})</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase text-brand-red">What Does Not Fit</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.mismatches.map((item) => (
              <li key={item.dimension}>• {item.explanation} {item.threshold ? `(${item.threshold})` : ""}</li>
            ))}
          </ul>
        </div>
      </div>
      {data.suggestedActions?.length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase text-slate-300">Suggested actions</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {data.suggestedActions.map((action, idx) => (
              <li key={`${action.action ?? "action"}-${idx}`}>
                • {action.action}: {action.reasoning}
                {action.targetPrice != null ? ` (target: $${action.targetPrice})` : ""}
                {action.alternatives?.length ? ` [${action.alternatives.join(", ")}]` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
