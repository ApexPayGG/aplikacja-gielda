import { TERMINAL_SIGNAL_PANEL } from "../terminal/terminalStyles";
import { MarketSignalsFootnote } from "./MarketSignalsFootnote";

type Props = {
  ticker: string;
  lookbackDays: number;
  compact?: boolean;
};

export function MarketSignalsEmptyState({ ticker, lookbackDays, compact = false }: Props) {
  return (
    <div className={TERMINAL_SIGNAL_PANEL}>
      <div className={`flex gap-3 sm:gap-4 ${compact ? "items-center" : "items-start"}`}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-terminal-cyan/25 bg-terminal-cyan/10 text-base text-terminal-cyan sm:h-11 sm:w-11 sm:text-lg"
          aria-hidden
        >
          ◎
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-terminal-text sm:text-base">
            No institutional signals detected for this lookback window.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-terminal-textSecondary">
            No stored signals match current filters for {ticker} over the last {lookbackDays} days.
          </p>
          {!compact ? (
            <p className="mt-2 text-xs leading-relaxed text-terminal-textMuted">
              This does not mean there is no activity; it means no stored signals match current filters.
            </p>
          ) : null}
        </div>
      </div>
      <MarketSignalsFootnote compact={compact} showConfidenceLegend={!compact} />
    </div>
  );
}
