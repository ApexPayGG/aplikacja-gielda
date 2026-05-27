import type { ReactNode } from "react";
import { cn } from "./cn";

type TerminalHeaderProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Compact section/page header block for terminal layouts. */
export function TerminalHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: TerminalHeaderProps) {
  if (!eyebrow && !title && !subtitle && !actions) return null;

  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-textMuted">
            {eyebrow}
          </p>
        )}
        {title && (
          <h2 className="mt-1 text-lg font-bold tracking-tight text-terminal-text md:text-xl">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-terminal-textSecondary">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
