import { TERMINAL_SIGNAL_PANEL } from "../terminal/terminalStyles";

type Props = {
  compact?: boolean;
};

export function MarketSignalsSkeleton({ compact = false }: Props) {
  const cardCount = compact ? 2 : 3;

  return (
    <div className={TERMINAL_SIGNAL_PANEL} aria-busy="true" aria-label="Loading market signals">
      <div className="animate-pulse space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-5 w-40 rounded-lg bg-terminal-panelSecondary" />
          <div className="h-6 w-24 rounded-full bg-terminal-panelSecondary" />
          <div className="h-6 w-28 rounded-full bg-terminal-panelSecondary" />
        </div>
        {!compact ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-terminal-panelSecondary" />
            ))}
          </div>
        ) : null}
        <div className="space-y-3">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} className="rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/50 p-4">
              <div className="flex gap-3">
                <div className="h-5 w-24 rounded-full bg-terminal-borderMuted" />
                <div className="h-5 flex-1 rounded bg-terminal-borderMuted" />
              </div>
              <div className="mt-3 h-4 w-full rounded bg-terminal-borderMuted" />
              <div className="mt-2 h-4 w-2/3 rounded bg-terminal-borderMuted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
