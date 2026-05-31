import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { TerminalSidebar } from "./TerminalSidebar";
import { TerminalTopBar } from "./TerminalTopBar";

type TerminalAppShellProps = {
  children: ReactNode;
  banner?: ReactNode;
  className?: string;
};

export function TerminalAppShell({ children, banner, className }: TerminalAppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className={cn("relative z-10 flex min-h-[calc(100vh-0px)] w-full", className)}>
      <TerminalSidebar className="hidden lg:flex" />

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <TerminalSidebar
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TerminalTopBar onOpenSidebar={() => setMobileNavOpen(true)} />
        {banner}
        <div className="flex-1 overflow-x-hidden bg-terminal-bg">{children}</div>
      </div>
    </div>
  );
}
