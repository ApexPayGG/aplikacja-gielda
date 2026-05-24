import { CONFIDENCE_TIER_HINTS, MARKET_SIGNALS_READONLY_FOOTNOTE } from "./marketSignals.types";

type Props = {
  compact?: boolean;
  showConfidenceLegend?: boolean;
};

export function MarketSignalsFootnote({ compact = false, showConfidenceLegend = true }: Props) {
  return (
    <footer className={`space-y-1.5 ${compact ? "mt-3" : "mt-4"} border-t border-white/[0.06] pt-3`}>
      <p className="text-[11px] leading-relaxed text-[#64748b]">{MARKET_SIGNALS_READONLY_FOOTNOTE}</p>
      {showConfidenceLegend && !compact ? (
        <p className="text-[11px] leading-relaxed text-[#64748b]">
          Confidence: High {CONFIDENCE_TIER_HINTS.high} · Medium {CONFIDENCE_TIER_HINTS.medium} · Low{" "}
          {CONFIDENCE_TIER_HINTS.low}
        </p>
      ) : null}
    </footer>
  );
}
