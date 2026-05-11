type TwinCardProps = {
  ticker: string;
  dateOfMatch: string;
  matchScore: number;
  lesson: string;
  outcome: {
    total_return_pct: number;
    max_drawdown_pct: number;
    volatility_annualized: number;
    notable_events?: string[];
  };
};

export function TwinCard({ ticker, dateOfMatch, matchScore, lesson, outcome }: TwinCardProps) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">
        {ticker} ({Math.round(matchScore)}%)
      </h3>
      <p className="mt-1 text-xs text-slate-500">{dateOfMatch}</p>
      <p className={`mt-2 text-sm font-semibold ${outcome.total_return_pct >= 0 ? "text-brand-green" : "text-brand-red"}`}>
        5Y outcome: {outcome.total_return_pct}%
      </p>
      <p className="text-xs text-slate-400">Max DD: {outcome.max_drawdown_pct}% · Vol: {outcome.volatility_annualized}%</p>
      {outcome.notable_events?.length ? (
        <p className="mt-2 text-xs text-slate-500">{outcome.notable_events.join(" | ")}</p>
      ) : null}
      <p className="mt-2 text-xs text-slate-300">{lesson}</p>
    </article>
  );
}
