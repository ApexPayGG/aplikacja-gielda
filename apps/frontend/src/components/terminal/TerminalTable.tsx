import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

type TerminalTableProps = {
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLTableElement>, "className">;

/** Simple dark table wrapper — no sorting or data-grid logic. */
export function TerminalTable({ className, children, ...rest }: TerminalTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-terminal-border bg-terminal-panel">
      <table
        className={cn("w-full min-w-full border-collapse text-left text-sm", className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

type TerminalTableSectionProps = {
  className?: string;
  children?: ReactNode;
};

export function TerminalTableHead({ className, children }: TerminalTableSectionProps) {
  return (
    <thead
      className={cn(
        "border-b border-terminal-border bg-terminal-panelSecondary/90",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TerminalTableBody({ className, children }: TerminalTableSectionProps) {
  return <tbody className={cn("divide-y divide-terminal-borderMuted/80", className)}>{children}</tbody>;
}

export function TerminalTableRow({ className, children }: TerminalTableSectionProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-terminal-panelSecondary/50",
        className,
      )}
    >
      {children}
    </tr>
  );
}

type TerminalTableHeaderCellProps = {
  className?: string;
  children?: ReactNode;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, "className">;

export function TerminalTableHeaderCell({
  className,
  children,
  ...rest
}: TerminalTableHeaderCellProps) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-textMuted",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

type TerminalTableCellProps = {
  className?: string;
  children?: ReactNode;
  mono?: boolean;
} & Omit<TdHTMLAttributes<HTMLTableCellElement>, "className">;

export function TerminalTableCell({
  className,
  children,
  mono = false,
  ...rest
}: TerminalTableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-terminal-textSecondary",
        mono && "font-mono tabular-nums text-terminal-text",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
