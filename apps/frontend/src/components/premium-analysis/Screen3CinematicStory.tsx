import { GLASS_INNER_PANEL, GLASS_SECTION } from "../behavioral-coach/glassStyles";
import { StoryAct } from "./StoryAct";

type StoryData = {
  acts: Array<{
    act: number;
    title: string;
    narrative?: string;
    key_numbers?: Array<{ label: string; value: string }>;
    scenarios?: Array<{ name: string; probability: number; narrative: string; target_price: number; target_pct: number }>;
  }>;
  synthesis?: string;
};

type Props = {
  data: StoryData | null;
  loading: boolean;
};

export function Screen3CinematicStory({ data, loading }: Props) {
  if (loading) return <div className={`${GLASS_INNER_PANEL} p-5 text-[#94a3b8]`}>Generating cinematic story...</div>;
  if (!data) return <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-5 text-brand-red">Story unavailable.</div>;

  return (
    <section className={`${GLASS_SECTION} space-y-4`}>
      <h2 className="text-xl font-semibold text-white">Screen 3 - Cinematic Story</h2>
      {data.acts.map((act) => (
        <StoryAct
          key={act.act}
          title={act.title}
          narrative={act.narrative}
          keyNumbers={act.key_numbers}
          scenarios={act.scenarios}
        />
      ))}
      {data.synthesis ? (
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/10 p-4 text-sm text-slate-200">
          Strategic takeaway: {data.synthesis}
        </div>
      ) : null}
    </section>
  );
}
