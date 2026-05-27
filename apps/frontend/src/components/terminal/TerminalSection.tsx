import type { ReactNode } from "react";
import { cn } from "./cn";
import { TerminalHeader } from "./TerminalHeader";

type TerminalSectionProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
};

/** Bordered terminal section with optional header and compact spacing. */
export function TerminalSection({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  contentClassName,
  children,
}: TerminalSectionProps) {
  const hasHeader = Boolean(eyebrow || title || subtitle || actions);

  return (
    <section
      className={cn(
        "rounded-lg border border-terminal-border bg-terminal-panel p-4 shadow-terminal-panel sm:p-5",
        className,
      )}
    >
      {hasHeader && (
        <TerminalHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          className="mb-4"
        />
      )}
      {children && <div className={cn("space-y-3", contentClassName)}>{children}</div>}
    </section>
  );
}
