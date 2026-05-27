import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type MarketDeltaVariant = "positive" | "negative" | "neutral";

const VARIANT_CLASS: Record<MarketDeltaVariant, string> = {
  positive: "text-terminal-positive",
  negative: "text-terminal-negative",
  neutral: "text-terminal-textMuted",
};

function resolveVariant(value: number): MarketDeltaVariant {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

/** Format percentage delta for terminal UI: +2.41%, -0.82%, 0.00% */
export function formatMarketDelta(value: number, decimals = 2): string {
  const fixed = Math.abs(value).toFixed(decimals);
  if (value > 0) return `+${fixed}%`;
  if (value < 0) return `-${fixed}%`;
  return `${fixed}%`;
}

type MarketDeltaProps = {
  value: number;
  variant?: MarketDeltaVariant;
  decimals?: number;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className">;

export function MarketDelta({
  value,
  variant,
  decimals = 2,
  className,
  ...rest
}: MarketDeltaProps) {
  const resolvedVariant = variant ?? resolveVariant(value);

  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums tracking-tight",
        VARIANT_CLASS[resolvedVariant],
        className,
      )}
      {...rest}
    >
      {formatMarketDelta(value, decimals)}
    </span>
  );
}
