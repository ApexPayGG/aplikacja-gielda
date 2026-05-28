import type { ReactNode } from "react";
import { TERMINAL_APP_BG, TERMINAL_PAGE_SHELL } from "../terminal/terminalStyles";

type GlassPageShellProps = {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
};

export function GlassPageShell({
  children,
  className = "",
  maxWidth = "max-w-7xl",
}: GlassPageShellProps) {
  return (
    <div className={`${TERMINAL_APP_BG} relative overflow-x-hidden`}>
      <div className={`${TERMINAL_PAGE_SHELL} ${maxWidth} space-y-6 py-8 sm:py-10 ${className}`}>
        {children}
      </div>
    </div>
  );
}
