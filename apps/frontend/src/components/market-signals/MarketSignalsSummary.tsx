import { GLASS_SIGNAL_CARD } from "../behavioral-coach/glassStyles";
import { getSignalTypeLabel, type MarketSignalsResponse } from "./marketSignals.types";

type Props = {
  summary: MarketSignalsResponse["summary"];
  compact?: boolean;
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${GLASS_SIGNAL_CARD} p-3 sm:p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function MarketSignalsSummary({ summary, compact = false }: Props) {
  const strongestLabel = summary.strongestSignalType
    ? getSignalTypeLabel(summary.strongestSignalType)
    : "—";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mb-1"}`}>
        {summary.whaleAccumulationDetected ? (
          <span className="inline-flex items-center rounded-full border border-[#a855f7]/40 bg-[#a855f7]/15 px-2.5 py-1 text-xs font-semibold text-[#e9d5ff]">
            Whale accumulation detected
          </span>
        ) : null}
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <StatBlock label="Total signals" value={String(summary.total)} />
        <StatBlock label="Strongest type" value={strongestLabel} />
        <StatBlock label="Avg confidence" value={`${Math.round(summary.averageConfidenceScore)}%`} />
        <StatBlock
          label="Whale activity"
          value={summary.whaleAccumulationDetected ? "Yes" : "No"}
        />
      </div>
    </div>
  );
}
