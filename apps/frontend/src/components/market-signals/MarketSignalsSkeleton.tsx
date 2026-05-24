import { GLASS_SECTION } from "../behavioral-coach/glassStyles";

type Props = {
  compact?: boolean;
};

export function MarketSignalsSkeleton({ compact = false }: Props) {
  const cardCount = compact ? 2 : 3;

  return (
    <div className={GLASS_SECTION} aria-busy="true" aria-label="Loading market signals">
      <div className="animate-pulse space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-5 w-40 rounded-lg bg-white/10" />
          <div className="h-6 w-24 rounded-full bg-white/10" />
          <div className="h-6 w-28 rounded-full bg-white/10" />
        </div>
        {!compact ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        ) : null}
        <div className="space-y-3">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
              <div className="flex gap-3">
                <div className="h-5 w-24 rounded-full bg-white/10" />
                <div className="h-5 flex-1 rounded bg-white/10" />
              </div>
              <div className="mt-3 h-4 w-full rounded bg-white/[0.06]" />
              <div className="mt-2 h-4 w-2/3 rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
