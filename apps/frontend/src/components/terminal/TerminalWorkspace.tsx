import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { TerminalAppShell } from "./TerminalAppShell";
import { TerminalButton, type TerminalButtonSize, type TerminalButtonVariant } from "./TerminalButton";
import { TerminalMetricCard } from "./TerminalMetricCard";
import { TerminalSidebar } from "./TerminalSidebar";
import { TerminalTopBar } from "./TerminalTopBar";
import {
  TerminalTable,
  TerminalTableBody,
  TerminalTableCell,
  TerminalTableHead,
  TerminalTableHeaderCell,
  TerminalTableRow,
} from "./TerminalTable";
import {
  TERMINAL_EMPTY_STATE_PANEL,
  TERMINAL_OS_CONTENT,
  TERMINAL_OS_EYEBROW,
  TERMINAL_OS_PAGE_TITLE,
  TERMINAL_OS_PAGE_SUBTITLE,
  TERMINAL_OS_PANEL,
  TERMINAL_OS_TAB_ACTIVE,
  TERMINAL_OS_TAB_IDLE,
  TERMINAL_OS_TAB_LIST,
} from "./terminalStyles";

/** Canonical authenticated workspace shell (sidebar + top bar). */
export const AppWorkspaceShell = TerminalAppShell;
export const WorkspaceSidebar = TerminalSidebar;
export const WorkspaceTopBar = TerminalTopBar;

export function SectionEyebrow({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <p
      className={cn(
        TERMINAL_OS_EYEBROW,
        accent && "text-terminal-cyan",
        className,
      )}
    >
      {children}
    </p>
  );
}

type PageCommandHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
};

/** Command-center page header — eyebrow, headline, subtitle, optional status rail. */
export function PageCommandHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  status,
  className,
}: PageCommandHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-terminal-border pb-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? <SectionEyebrow className="mb-2">{eyebrow}</SectionEyebrow> : null}
          <h1 className={TERMINAL_OS_PAGE_TITLE}>{title}</h1>
          {subtitle ? <p className={cn(TERMINAL_OS_PAGE_SUBTITLE, "mt-2")}>{subtitle}</p> : null}
          {status ? <div className="mt-3">{status}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

type TerminalWorkspacePageProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
};

/** Standard terminal page canvas inside AppWorkspaceShell. */
export function TerminalWorkspacePage({
  eyebrow,
  title,
  subtitle,
  actions,
  status,
  className,
  contentClassName,
  children,
}: TerminalWorkspacePageProps) {
  const hasHeader = Boolean(eyebrow || title || subtitle || actions || status);

  return (
    <div className={cn(TERMINAL_OS_CONTENT, className)}>
      {hasHeader && title ? (
        <PageCommandHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          status={status}
        />
      ) : null}
      {children ? (
        <div className={cn(hasHeader ? "mt-5 space-y-4" : "space-y-4", contentClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalPanel({
  children,
  className,
  muted,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        muted ? "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/80 shadow-terminal-panel" : TERMINAL_OS_PANEL,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export const MetricTile = TerminalMetricCard;

export const TerminalDataTable = TerminalTable;
export {
  TerminalTableBody as TerminalDataTableBody,
  TerminalTableCell as TerminalDataTableCell,
  TerminalTableHead as TerminalDataTableHead,
  TerminalTableHeaderCell as TerminalDataTableHeaderCell,
  TerminalTableRow as TerminalDataTableRow,
};

export type TerminalTabItem<T extends string = string> = {
  id: T;
  label: ReactNode;
};

type TerminalTabsProps<T extends string> = {
  tabs: TerminalTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
};

/** Segmented terminal tabs — uppercase micro labels, cyan active rail. */
export function TerminalTabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className,
}: TerminalTabsProps<T>) {
  return (
    <nav className={cn(TERMINAL_OS_TAB_LIST, className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? TERMINAL_OS_TAB_ACTIVE : TERMINAL_OS_TAB_IDLE}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

type EmptyStatePanelProps = {
  title?: ReactNode;
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function EmptyStatePanel({ title, message, actions, className }: EmptyStatePanelProps) {
  return (
    <div className={cn(TERMINAL_EMPTY_STATE_PANEL, className)}>
      {title ? (
        <p className="text-sm font-semibold text-terminal-text">{title}</p>
      ) : null}
      <p className={cn("text-sm text-terminal-textSecondary", title ? "mt-1" : undefined)}>{message}</p>
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ModuleCTAButton({
  children,
  variant = "primary",
  size = "sm",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: TerminalButtonVariant;
  size?: TerminalButtonSize;
  className?: string;
} & ComponentProps<typeof TerminalButton>) {
  return (
    <TerminalButton variant={variant} size={size} className={className} {...rest}>
      {children}
    </TerminalButton>
  );
}
