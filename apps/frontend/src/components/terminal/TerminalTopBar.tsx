import { useEffect, useRef, useState } from "react";
import { Bars3Icon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "../BrandLogo";
import { GlobalSearchBar } from "../GlobalSearchBar";
import LanguageSwitcher from "../LanguageSwitcher";
import { NotificationsCenter } from "../NotificationsCenter";
import { useAuth } from "../../context/AuthContext";
import { cn } from "./cn";

type TerminalTopBarProps = {
  onOpenSidebar?: () => void;
  className?: string;
};

export function TerminalTopBar({ onOpenSidebar, className }: TerminalTopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const userEmail = user?.email ?? "";
  const userName = user?.name?.trim() ?? "";
  const userInitials = (userName || userEmail || "U")
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  useEffect(() => {
    if (!accountOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [accountOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-terminal-border bg-terminal-bg/92 px-3 backdrop-blur-xl sm:px-4",
        className,
      )}
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-terminal-borderMuted text-terminal-textSecondary transition hover:border-terminal-cyan/35 hover:text-terminal-cyan lg:hidden"
        onClick={onOpenSidebar}
        aria-label={t("terminalNav.openMenu")}
      >
        <Bars3Icon className="h-5 w-5" aria-hidden />
      </button>

      <Link to="/dashboard" className="hidden shrink-0 sm:block">
        <BrandLogo size="mini" />
      </Link>

      <div className="min-w-0 flex-1">
        <GlobalSearchBar variant="desktop" />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <NotificationsCenter />
        {user ? (
          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-md border border-terminal-borderMuted bg-terminal-panelSecondary/70 px-1.5 py-1 transition hover:border-terminal-cyan/35"
              aria-expanded={accountOpen}
              aria-haspopup="true"
              title={userEmail}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-terminal-cyanDark to-terminal-cyan text-xs font-bold text-terminal-buttonText"
                aria-hidden
              >
                {userInitials}
              </span>
              <ChevronDownIcon
                className={cn(
                  "hidden h-4 w-4 shrink-0 text-terminal-textSecondary transition-transform sm:block",
                  accountOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-terminal-border bg-terminal-panel py-1 shadow-terminal-panel">
                <div className="border-b border-terminal-border px-3 py-2.5">
                  {userName ? (
                    <p className="truncate text-sm font-semibold text-terminal-text">{userName}</p>
                  ) : null}
                  <p className="truncate text-xs text-terminal-textMuted">{userEmail}</p>
                </div>
                <NavLink
                  to="/profile"
                  className="block px-3 py-2 text-sm font-medium text-terminal-textSecondary transition hover:bg-terminal-panelSecondary hover:text-terminal-text"
                  onClick={() => setAccountOpen(false)}
                >
                  {t("nav.profile")}
                </NavLink>
                <NavLink
                  to="/settings"
                  className="block px-3 py-2 text-sm font-medium text-terminal-textSecondary transition hover:bg-terminal-panelSecondary hover:text-terminal-text"
                  onClick={() => setAccountOpen(false)}
                >
                  {t("nav.settings")}
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    handleLogout();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-terminal-negative transition hover:bg-terminal-panelSecondary"
                >
                  {t("nav.logout")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
