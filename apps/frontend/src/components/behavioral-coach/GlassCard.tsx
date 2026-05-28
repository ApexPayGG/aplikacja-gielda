import type { ElementType, ReactNode } from "react";
import {
  TERMINAL_COACH_CARD,
  TERMINAL_COACH_PANEL,
  TERMINAL_COMPANY_CARD,
  TERMINAL_FILTER_PANEL,
  TERMINAL_METRIC_TILE,
  TERMINAL_SIGNAL_CARD,
} from "../terminal/terminalStyles";

export type GlassCardVariant =
  | "section"
  | "hero"
  | "stat"
  | "watchlist"
  | "widget"
  | "company"
  | "signal"
  | "inner"
  | "filter";

const VARIANT_CLASS: Record<GlassCardVariant, string> = {
  section: TERMINAL_COACH_PANEL,
  hero: `${TERMINAL_COACH_PANEL} border-terminal-cyan/25`,
  stat: TERMINAL_METRIC_TILE,
  watchlist: TERMINAL_COACH_CARD,
  widget: TERMINAL_COACH_PANEL,
  company: TERMINAL_COMPANY_CARD,
  signal: TERMINAL_SIGNAL_CARD,
  inner: TERMINAL_COACH_CARD,
  filter: TERMINAL_FILTER_PANEL,
};

type GlassCardProps = {
  variant?: GlassCardVariant;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

/** Terminal surface wrapper — legacy name kept for coach module consumers. */
export function GlassCard({
  variant = "section",
  as: Component = "div",
  className = "",
  children,
}: GlassCardProps) {
  const base = VARIANT_CLASS[variant];
  return <Component className={className ? `${base} ${className}` : base}>{children}</Component>;
}
