import { GLASS_SECTION } from "../behavioral-coach/glassStyles";
import { MarketSignalsFootnote } from "./MarketSignalsFootnote";

type Props = {
  ticker: string;
  lookbackDays: number;
  compact?: boolean;
};

export function MarketSignalsEmptyState({ ticker, lookbackDays, compact = false }: Props) {
  return (
    <div className={GLASS_SECTION}>
      <div className={`flex gap-3 sm:gap-4 ${compact ? "items-center" : "items-start"}`}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/10 text-base sm:h-11 sm:w-11 sm:text-lg"
          aria-hidden
        >
          ◎
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white sm:text-base">
            No institutional signals detected for this lookback window.
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#94a3b8]">
            No stored signals match current filters for {ticker} over the last {lookbackDays} days.
          </p>
          {!compact ? (
            <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
              This does not mean there is no activity; it means no stored signals match current filters.
            </p>
          ) : null}
        </div>
      </div>
      <MarketSignalsFootnote compact={compact} showConfidenceLegend={!compact} />
    </div>
  );
}
