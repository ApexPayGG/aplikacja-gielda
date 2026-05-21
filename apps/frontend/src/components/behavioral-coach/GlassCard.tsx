import type { ElementType, ReactNode } from "react";
import {
  GLASS_COMPANY_CARD,
  GLASS_FILTER_PANEL,
  GLASS_HERO,
  GLASS_INNER_PANEL,
  GLASS_SECTION,
  GLASS_SIGNAL_CARD,
  GLASS_STAT_CARD,
  GLASS_WATCHLIST_CARD,
  GLASS_WIDGET_SHELL,
} from "./glassStyles";

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
  section: GLASS_SECTION,
  hero: GLASS_HERO,
  stat: GLASS_STAT_CARD,
  watchlist: GLASS_WATCHLIST_CARD,
  widget: GLASS_WIDGET_SHELL,
  company: GLASS_COMPANY_CARD,
  signal: GLASS_SIGNAL_CARD,
  inner: GLASS_INNER_PANEL,
  filter: GLASS_FILTER_PANEL,
};

type GlassCardProps = {
  variant?: GlassCardVariant;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

/** Unified glass surface — one model, role-specific variants from glassStyles. */
export function GlassCard({
  variant = "section",
  as: Component = "div",
  className = "",
  children,
}: GlassCardProps) {
  const base = VARIANT_CLASS[variant];
  return <Component className={className ? `${base} ${className}` : base}>{children}</Component>;
}
