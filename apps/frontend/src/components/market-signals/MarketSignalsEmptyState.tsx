import { GLASS_SECTION } from "../behavioral-coach/glassStyles";

type Props = {
  ticker: string;
  lookbackDays: number;
  compact?: boolean;
};

export function MarketSignalsEmptyState({ ticker, lookbackDays, compact = false }: Props) {
  return (
    <div className={GLASS_SECTION}>
      <div className={`flex gap-4 ${compact ? "items-center" : "items-start"}`}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/10 text-lg"
          aria-hidden
        >
          ◎
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">No institutional signals</h3>
          <p className="mt-1 text-sm text-[#94a3b8]">
            No market signals were recorded for {ticker} in the last {lookbackDays} days.
          </p>
          {!compact ? (
            <p className="mt-2 text-xs text-[#64748b]">
              Signals include options flow, dark pool activity, SEC filings, insider trades, and analyst revisions.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
