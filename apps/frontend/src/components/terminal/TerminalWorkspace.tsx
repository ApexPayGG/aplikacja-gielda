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
  TERMINAL_ACCENT_RAIL_AMBER,
  TERMINAL_ACCENT_RAIL_CYAN,
  TERMINAL_ACCENT_RAIL_LIME,
  TERMINAL_COCKPIT_BAND,
  TERMINAL_COMPACT_EMPTY,
  TERMINAL_MODULE_PANEL,
  TERMINAL_OS_CONTENT,
  TERMINAL_PANEL_ELEVATED_AMBER,
  TERMINAL_PANEL_ELEVATED_CYAN,
  TERMINAL_PANEL_ELEVATED_LIME,
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
  dense?: boolean;
};

/** Command-center page header — eyebrow, headline, subtitle, optional status rail. */
export function PageCommandHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  status,
  className,
  dense = false,
}: PageCommandHeaderProps) {
  return (
    <header
      className={cn(
        dense ? "border-b border-terminal-borderMuted/80 pb-2.5" : "border-b border-terminal-border pb-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col lg:flex-row lg:items-start lg:justify-between",
          dense ? "gap-2" : "gap-3",
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? <SectionEyebrow className={dense ? "mb-1" : "mb-2"}>{eyebrow}</SectionEyebrow> : null}
          <h1 className={cn(TERMINAL_OS_PAGE_TITLE, dense && "text-lg sm:text-xl md:text-2xl")}>{title}</h1>
          {subtitle ? (
            <p className={cn(TERMINAL_OS_PAGE_SUBTITLE, dense ? "mt-1" : "mt-2")}>{subtitle}</p>
          ) : null}
          {status ? <div className={dense ? "mt-1.5" : "mt-3"}>{status}</div> : null}
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
  dense?: boolean;
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
  dense = false,
  children,
}: TerminalWorkspacePageProps) {
  const hasHeader = Boolean(eyebrow || title || subtitle || actions || status);

  return (
    <div className={cn(TERMINAL_OS_CONTENT, dense && "py-3 sm:py-4", className)}>
      {hasHeader && title ? (
        <PageCommandHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          status={status}
          dense={dense}
        />
      ) : null}
      {children ? (
        <div
          className={cn(
            hasHeader ? (dense ? "mt-2" : "mt-5") : undefined,
            dense ? "space-y-2" : "space-y-4",
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type AccentPanelVariant = "cyan" | "amber" | "lime" | "base";

const ACCENT_PANEL_CLASS: Record<AccentPanelVariant, string> = {
  cyan: TERMINAL_PANEL_ELEVATED_CYAN,
  amber: TERMINAL_PANEL_ELEVATED_AMBER,
  lime: TERMINAL_PANEL_ELEVATED_LIME,
  base: TERMINAL_MODULE_PANEL,
};

const ACCENT_RAIL_CLASS: Record<AccentPanelVariant, string> = {
  cyan: TERMINAL_ACCENT_RAIL_CYAN,
  amber: TERMINAL_ACCENT_RAIL_AMBER,
  lime: TERMINAL_ACCENT_RAIL_LIME,
  base: "",
};

/** Command cockpit band — gradient header strip for KPI / setup modules. */
export function CockpitBand({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(TERMINAL_COCKPIT_BAND, "p-2.5 sm:p-3", className)}>{children}</div>;
}

export function AccentPanel({
  variant = "base",
  showRail = true,
  className,
  children,
}: {
  variant?: AccentPanelVariant;
  showRail?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        ACCENT_PANEL_CLASS[variant],
        showRail && ACCENT_RAIL_CLASS[variant],
        "pl-2.5 sm:pl-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Dense terminal empty state — less SaaS padding than EmptyStatePanel. */
export function CompactEmptyState({
  title,
  message,
  actions,
  className,
}: {
  title?: ReactNode;
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(TERMINAL_COMPACT_EMPTY, className)}>
      {title ? (
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-textMuted">
          {title}
        </p>
      ) : null}
      <p className={cn("text-xs leading-snug text-terminal-textSecondary", title ? "mt-1.5" : undefined)}>
        {message}
      </p>
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
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
