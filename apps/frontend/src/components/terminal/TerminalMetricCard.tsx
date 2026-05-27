import type { ReactNode } from "react";
import { cn } from "./cn";
import { MarketDelta } from "./MarketDelta";
import { TerminalCard } from "./TerminalCard";

type TerminalMetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  delta?: number;
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
};

/** Compact KPI tile — uppercase micro label + mono value + optional delta. */
export function TerminalMetricCard({
  label,
  value,
  delta,
  hint,
  className,
  valueClassName,
}: TerminalMetricCardProps) {
  return (
    <TerminalCard variant="default" className={cn("p-3 sm:p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-textMuted">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p
          className={cn(
            "font-mono text-xl font-bold tabular-nums tracking-tight text-terminal-text sm:text-2xl",
            valueClassName,
          )}
        >
          {value}
        </p>
        {delta !== undefined && Number.isFinite(delta) && <MarketDelta value={delta} />}
      </div>
      {hint && (
        <p className="mt-2 text-[11px] leading-snug text-terminal-textSecondary">{hint}</p>
      )}
    </TerminalCard>
  );
}
