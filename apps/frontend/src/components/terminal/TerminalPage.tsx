import type { ReactNode } from "react";
import { cn } from "./cn";
import { TerminalHeader } from "./TerminalHeader";

type TerminalPageProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
};

/** Top-level terminal page wrapper with optional header and dense content area. */
export function TerminalPage({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  contentClassName,
  children,
}: TerminalPageProps) {
  const hasHeader = Boolean(eyebrow || title || subtitle || actions);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-5 text-terminal-text sm:px-6 sm:py-6 lg:px-8",
        className,
      )}
    >
      {hasHeader && (
        <TerminalHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          className="mb-6 [&_h2]:text-2xl [&_h2]:md:text-3xl [&_p:last-of-type]:text-sm"
        />
      )}
      {children && <div className={cn("space-y-4", contentClassName)}>{children}</div>}
    </div>
  );
}
