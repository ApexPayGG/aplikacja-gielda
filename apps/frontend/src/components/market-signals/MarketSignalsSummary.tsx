import { TERMINAL_LIVE_STATUS, TERMINAL_METRIC_TILE } from "../terminal/terminalStyles";
import { getSignalTypeLabel, type MarketSignalsResponse } from "./marketSignals.types";

type Props = {
  summary: MarketSignalsResponse["summary"];
  compact?: boolean;
};

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className={TERMINAL_METRIC_TILE}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-textMuted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-terminal-text">{value}</p>
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
          <span className={TERMINAL_LIVE_STATUS}>Whale accumulation detected</span>
        ) : null}
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <StatBlock label="Total signals" value={String(summary.total)} />
        <StatBlock label="Strongest type" value={strongestLabel} />
        <StatBlock label="Avg confidence" value={`${Math.round(summary.averageConfidenceScore)}%`} />
        <StatBlock label="Whale activity" value={summary.whaleAccumulationDetected ? "Yes" : "No"} />
      </div>
    </div>
  );
}
