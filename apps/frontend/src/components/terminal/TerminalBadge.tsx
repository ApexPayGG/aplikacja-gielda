import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type TerminalBadgeVariant =
  | "default"
  | "live"
  | "ai"
  | "positive"
  | "negative"
  | "warning"
  | "soon"
  | "pro"
  | "proPlus";

const VARIANT_CLASS: Record<TerminalBadgeVariant, string> = {
  default: "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textSecondary",
  live: "border-terminal-positive/40 bg-terminal-positive/10 text-terminal-positive",
  ai: "border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan",
  positive: "border-terminal-positive/35 bg-terminal-positive/10 text-terminal-positive",
  negative: "border-terminal-negative/35 bg-terminal-negative/10 text-terminal-negative",
  warning: "border-terminal-warning/35 bg-terminal-warning/10 text-terminal-warning",
  soon: "border-terminal-borderMuted bg-terminal-bgAlt text-terminal-textMuted",
  pro: "border-terminal-cyan/30 bg-terminal-panelSecondary text-terminal-cyan",
  proPlus: "border-terminal-warning/40 bg-terminal-warning/10 text-terminal-warning",
};

type TerminalBadgeProps = {
  variant?: TerminalBadgeVariant;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className">;

export function TerminalBadge({
  variant = "default",
  className,
  children,
  ...rest
}: TerminalBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
