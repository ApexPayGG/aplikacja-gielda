import { GLASS_INNER_PANEL, GLASS_SECTION } from "../behavioral-coach/glassStyles";
import { VerdictScoreCircle } from "./VerdictScoreCircle";

type VerdictData = {
  ticker: string;
  score: number;
  label: string;
  prices: {
    current: number;
    entryLow: number;
    entryHigh: number;
    target12m: number;
    stopLoss: number;
    riskReward: number;
  };
  horizonMonths: number;
};

type Screen1VerdictProps = {
  data: VerdictData | null;
  loading: boolean;
  onNext: () => void;
};

export function Screen1Verdict({ data, loading, onNext }: Screen1VerdictProps) {
  if (loading) return <div className={`${GLASS_INNER_PANEL} p-5 text-[#94a3b8]`}>Loading verdict...</div>;
  if (!data) return <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-5 text-brand-red">Verdict unavailable.</div>;

  return (
    <section className={`${GLASS_SECTION} space-y-4`}>
      <header>
        <h2 className="text-xl font-semibold text-white">Screen 1 - Verdict</h2>
        <p className="text-sm text-slate-400">{data.ticker} · 5-second decision layer</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <VerdictScoreCircle score={data.score} label={data.label} />
        <div className="space-y-2 text-sm text-slate-200">
          <p>Entry: ${data.prices.entryLow.toFixed(2)} - ${data.prices.entryHigh.toFixed(2)}</p>
          <p>Target 12m: ${data.prices.target12m.toFixed(2)}</p>
          <p>Stop loss: ${data.prices.stopLoss.toFixed(2)}</p>
          <p>R/R ratio: {data.prices.riskReward.toFixed(2)}</p>
          <p>Horizon: {data.horizonMonths}-{data.horizonMonths + 6} months</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white">Buy now</button>
        <button type="button" className="rounded-lg border border-brand-border px-4 py-2 text-sm text-slate-300">Set alert</button>
        <button type="button" onClick={onNext} className="rounded-lg border border-brand-green/60 bg-brand-green/10 px-4 py-2 text-sm text-brand-green">Show full analysis</button>
      </div>
    </section>
  );
}
