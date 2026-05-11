type StoryActProps = {
  title: string;
  narrative?: string;
  keyNumbers?: Array<{ label: string; value: string }>;
  scenarios?: Array<{
    name: string;
    probability: number;
    narrative: string;
    target_price: number;
    target_pct: number;
  }>;
};

export function StoryAct({ title, narrative, keyNumbers, scenarios }: StoryActProps) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-blue">{title}</h3>
      {narrative ? <p className="mt-2 text-sm leading-relaxed text-slate-300">{narrative}</p> : null}
      {keyNumbers?.length ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          {keyNumbers.map((k) => (
            <li key={k.label}>
              - {k.label}: {k.value}
            </li>
          ))}
        </ul>
      ) : null}
      {scenarios?.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {scenarios.map((s) => (
            <div key={s.name} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="font-semibold text-white">
                {s.name} ({s.probability}%)
              </p>
              <p className="mt-1">{s.narrative}</p>
              <p className="mt-2 text-brand-blue">
                Target: ${s.target_price.toFixed(2)} ({s.target_pct.toFixed(0)}%)
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
