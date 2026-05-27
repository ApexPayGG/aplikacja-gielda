import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type StatusPillVariant =
  | "live"
  | "open"
  | "closed"
  | "soon"
  | "active"
  | "inactive";

const VARIANT_CLASS: Record<StatusPillVariant, { pill: string; dot: string }> = {
  live: {
    pill: "border-terminal-positive/35 bg-terminal-positive/10 text-terminal-positive",
    dot: "bg-terminal-positive shadow-[0_0_6px_rgba(74,222,128,0.6)]",
  },
  open: {
    pill: "border-terminal-cyan/35 bg-terminal-cyan/10 text-terminal-cyan",
    dot: "bg-terminal-cyan",
  },
  closed: {
    pill: "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textMuted",
    dot: "bg-terminal-textMuted",
  },
  soon: {
    pill: "border-terminal-borderMuted bg-terminal-bgAlt text-terminal-textMuted",
    dot: "bg-terminal-warning",
  },
  active: {
    pill: "border-terminal-cyan/30 bg-terminal-panelSecondary text-terminal-text",
    dot: "bg-terminal-cyanStrong",
  },
  inactive: {
    pill: "border-terminal-borderMuted bg-terminal-panel text-terminal-textMuted",
    dot: "bg-terminal-textMuted/60",
  },
};

type StatusPillProps = {
  variant?: StatusPillVariant;
  showDot?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className">;

export function StatusPill({
  variant = "active",
  showDot = true,
  className,
  children,
  ...rest
}: StatusPillProps) {
  const styles = VARIANT_CLASS[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles.pill,
        className,
      )}
      {...rest}
    >
      {showDot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
