export type TrendDirection = "up" | "down" | "stable";

export interface TrendIndicatorProps {
  direction: TrendDirection;
  percentage?: number;
}

const copy: Record<TrendDirection, { label: string; arrow: string; className: string }> = {
  up: { label: "Dividend Growing", arrow: "↑", className: "text-emerald-400" },
  down: { label: "Dividend Declining", arrow: "↓", className: "text-red-400" },
  stable: { label: "Stable", arrow: "→", className: "text-slate-400" },
};

/** Wskaźnik kierunku trendu dywidendy. */
export function TrendIndicator({ direction, percentage }: TrendIndicatorProps) {
  const cfg = copy[direction] ?? copy.stable;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Trend</h2>
      <div className={`mt-4 flex items-center gap-3 text-2xl font-semibold ${cfg.className}`}>
        <span aria-hidden>{cfg.arrow}</span>
        <span>{cfg.label}</span>
      </div>
      {percentage !== undefined && Number.isFinite(percentage) && (
        <p className="mt-2 text-sm text-slate-500">{percentage > 0 ? "+" : ""}{percentage.toFixed(1)}% vs baseline</p>
      )}
    </div>
  );
}
