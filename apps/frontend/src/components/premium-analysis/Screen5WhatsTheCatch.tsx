import { GLASS_INNER_PANEL, GLASS_SECTION } from "../behavioral-coach/glassStyles";
import { ActionButtons } from "./ActionButtons";
import { BullBearComparison } from "./BullBearComparison";
import { DirtyTruthBox } from "./DirtyTruthBox";

type CatchData = {
  bull_case: { narrative: string };
  bear_case: { narrative: string };
  dirty_truth: { one_liner: string; details: string; severity: string } | null;
  pre_mortem_context: { auto_filled_prompts: string[] };
};

type Props = {
  data: CatchData | null;
  loading: boolean;
  onPreMortem: () => void;
  onMirrorTrade?: () => void;
};

export function Screen5WhatsTheCatch({ data, loading, onPreMortem, onMirrorTrade }: Props) {
  if (loading) return <div className={`${GLASS_INNER_PANEL} p-5 text-[#94a3b8]`}>Loading catch analysis...</div>;
  if (!data) return <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-5 text-brand-red">Catch data unavailable.</div>;

  return (
    <section className={`${GLASS_SECTION} space-y-4`}>
      <h2 className="text-xl font-semibold text-white">Screen 5 - What's the Catch</h2>
      <BullBearComparison bullNarrative={data.bull_case.narrative} bearNarrative={data.bear_case.narrative} />
      <DirtyTruthBox dirtyTruth={data.dirty_truth} />
      <div className="rounded-xl border border-brand-blue/40 bg-brand-blue/10 p-4">
        <p className="text-sm font-semibold text-brand-blue">Pre-Mortem context</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          {data.pre_mortem_context.auto_filled_prompts.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        <div className="mt-3">
          <ActionButtons onPreMortem={onPreMortem} onMirrorTrade={onMirrorTrade} />
        </div>
      </div>
    </section>
  );
}
