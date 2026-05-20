import type { ReactNode } from "react";
import { GlassAmbient } from "./GlassAmbient";
import { GLASS_PAGE_BG } from "./glassStyles";

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
    <div className={`${GLASS_PAGE_BG} relative overflow-x-hidden`}>
      <GlassAmbient />
      <div className={`relative z-10 mx-auto ${maxWidth} px-4 py-8 sm:px-6 lg:py-10 ${className}`}>{children}</div>
    </div>
  );
}
