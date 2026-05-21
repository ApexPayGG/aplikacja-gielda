import { GLASS_INNER_PANEL, GLASS_SECTION } from "../behavioral-coach/glassStyles";
import { TwinCard } from "./TwinCard";

type TwinData = {
  twins: Array<{
    ticker: string;
    date_of_match: string;
    match_score: number;
    outcome_5y: {
      total_return_pct: number;
      max_drawdown_pct: number;
      volatility_annualized: number;
      notable_events?: string[];
    };
    lesson: string;
    common_attributes?: Array<{ dimension: string; current: string | number | boolean; twin: string | number | boolean }>;
  }>;
  statistics: { bullish_outcomes: number; flat_outcomes: number; bearish_outcomes: number; avg_5y_return: number };
  ai_synthesis: string;
};

type Props = {
  data: TwinData | null;
  loading: boolean;
};

export function Screen4HistoricalTwin({ data, loading }: Props) {
  if (loading) return <div className={`${GLASS_INNER_PANEL} p-5 text-[#94a3b8]`}>Loading historical twins...</div>;
  if (!data) return <div className={`${GLASS_INNER_PANEL} border-[#f87171]/40 bg-[#f87171]/10 p-5 text-[#f87171]`}>Twins unavailable.</div>;

  const shareText = encodeURIComponent(`Historical Twins insight:\n${data.ai_synthesis}`);
  return (
    <section className={`${GLASS_SECTION} space-y-4`}>
      <h2 className="text-xl font-semibold text-white">Screen 4 - Historical Twin</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {data.twins.map((twin) => (
          <TwinCard
            key={`${twin.ticker}-${twin.date_of_match}`}
            ticker={twin.ticker}
            dateOfMatch={twin.date_of_match}
            matchScore={twin.match_score}
            lesson={twin.lesson}
            outcome={twin.outcome_5y}
          />
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p>Bull: {data.statistics.bullish_outcomes} · Flat: {data.statistics.flat_outcomes} · Bear: {data.statistics.bearish_outcomes}</p>
        <p>Average 5Y return: {data.statistics.avg_5y_return}%</p>
        <p className="mt-2">{data.ai_synthesis}</p>
        <a
          href={`https://x.com/intent/tweet?text=${shareText}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-lg border border-brand-blue/50 bg-brand-blue/10 px-3 py-1 text-xs text-brand-blue"
        >
          Share on X
        </a>
      </div>
    </section>
  );
}
