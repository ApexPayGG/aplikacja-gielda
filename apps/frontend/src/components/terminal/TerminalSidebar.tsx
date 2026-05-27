import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TERMINAL_ACTIVE_NAV,
  TERMINAL_SOON_NAV,
  TERMINAL_SYSTEM_NAV,
  isTerminalNavActive,
  type TerminalNavItem,
} from "../../config/navConfig";
import { TerminalBadge } from "./TerminalBadge";
import { cn } from "./cn";

type TerminalSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: TerminalNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const active = isTerminalNavActive(pathname, item);
  const label = t(item.labelKey);

  if (!item.enabled || !item.to) {
    return (
      <div
        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-terminal-textMuted opacity-70"
        aria-disabled
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate text-xs font-medium">{label}</span>
        <TerminalBadge variant="soon" className="ml-auto">
          {t("terminalNav.soon")}
        </TerminalBadge>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-xs font-medium transition",
        active
          ? "border-terminal-cyan/30 bg-terminal-cyan/10 text-terminal-cyan"
          : "border-transparent text-terminal-textSecondary hover:border-terminal-borderMuted hover:bg-terminal-panelSecondary/70 hover:text-terminal-text",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-terminal-cyan" : "text-terminal-textMuted group-hover:text-terminal-textSecondary",
        )}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function TerminalSidebar({ className, onNavigate }: TerminalSidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        "flex h-full w-[15.5rem] shrink-0 flex-col border-r border-terminal-border bg-terminal-panel/95 backdrop-blur-xl",
        className,
      )}
    >
      <div className="border-b border-terminal-border px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-textMuted">
          {t("terminalNav.workspace")}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label={t("terminalNav.mainNav")}>
        {TERMINAL_ACTIVE_NAV.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}

        {TERMINAL_SOON_NAV.length > 0 ? (
          <div className="pt-4">
            <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-terminal-textMuted">
              {t("terminalNav.comingSoon")}
            </p>
            <div className="space-y-1">
              {TERMINAL_SOON_NAV.map((item) => (
                <NavRow key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>

      <div className="space-y-1 border-t border-terminal-border px-2 py-3">
        {TERMINAL_SYSTEM_NAV.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </aside>
  );
}
