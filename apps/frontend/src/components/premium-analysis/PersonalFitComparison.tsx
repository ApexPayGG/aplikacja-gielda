type PersonalFitComparisonProps = {
  marketScore: number;
  personalScore: number;
  delta: number;
};

export function PersonalFitComparison({
  marketScore,
  personalScore,
  delta,
}: PersonalFitComparisonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
        <p className="text-xs uppercase text-slate-500">Market</p>
        <p className="text-2xl font-bold text-white">{Math.round(marketScore)}</p>
      </div>
      <div className="rounded-xl border border-brand-blue/50 bg-brand-blue/10 p-3 text-center">
        <p className="text-xs uppercase text-slate-400">Your Fit</p>
        <p className="text-2xl font-bold text-brand-blue">{Math.round(personalScore)}</p>
      </div>
      <div className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 p-3 text-center">
        <p className="text-xs uppercase text-slate-400">Delta</p>
        <p className={`text-2xl font-bold ${delta >= 0 ? "text-brand-green" : "text-brand-red"}`}>
          {delta.toFixed(0)}
        </p>
      </div>
    </div>
  );
}
