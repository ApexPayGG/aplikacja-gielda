import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type TerminalCardVariant = "default" | "elevated" | "interactive" | "cyan" | "danger";

const VARIANT_CLASS: Record<TerminalCardVariant, string> = {
  default:
    "rounded-lg border border-terminal-border bg-terminal-panel shadow-terminal-panel",
  elevated:
    "rounded-lg border border-terminal-border bg-terminal-panelSecondary shadow-terminal-panel",
  interactive:
    "rounded-lg border border-terminal-borderMuted bg-terminal-panel shadow-terminal-panel transition hover:border-terminal-cyan/35 hover:shadow-terminal-glow",
  cyan:
    "rounded-lg border border-terminal-cyan/25 bg-gradient-to-br from-terminal-panel via-terminal-panelSecondary/80 to-terminal-cyan/5 shadow-terminal-glow",
  danger:
    "rounded-lg border border-terminal-negative/30 bg-terminal-panel shadow-terminal-panel",
};

type TerminalCardProps = {
  variant?: TerminalCardVariant;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className">;

export function TerminalCard({
  variant = "default",
  as: Component = "div",
  className,
  children,
  ...rest
}: TerminalCardProps) {
  return (
    <Component className={cn(VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </Component>
  );
}
