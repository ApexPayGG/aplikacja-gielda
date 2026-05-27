import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type TerminalButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type TerminalButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<TerminalButtonVariant, string> = {
  primary:
    "bg-terminal-cyan text-terminal-buttonText shadow-[0_4px_20px_rgba(34,211,238,0.3)] hover:bg-terminal-cyanStrong",
  secondary:
    "border border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-text hover:border-terminal-cyan/40 hover:bg-terminal-panel",
  ghost:
    "border border-terminal-cyan/35 bg-transparent text-terminal-cyan hover:bg-terminal-cyan/10",
  outline:
    "border border-terminal-border bg-transparent text-terminal-textSecondary hover:border-terminal-cyan/40 hover:text-terminal-text",
  danger:
    "border border-terminal-negative/40 bg-terminal-negative/10 text-terminal-negative hover:bg-terminal-negative/20",
};

const SIZE_CLASS: Record<TerminalButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

type TerminalButtonProps = {
  variant?: TerminalButtonVariant;
  size?: TerminalButtonSize;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function TerminalButton({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: TerminalButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan/40 disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
