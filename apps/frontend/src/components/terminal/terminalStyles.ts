/**
 * Canonical institutional terminal tokens for authenticated app surfaces.
 * Prefer these over glassStyles / light SaaS tokens in app shell, nav, and cockpit UI.
 */

export const TERMINAL_APP_BG = "min-h-screen bg-terminal-bg text-terminal-text";

export const TERMINAL_PAGE_SHELL = "mx-auto w-full max-w-[90rem] px-3 sm:px-4";

export const TERMINAL_PANEL =
  "rounded-lg border border-terminal-border bg-terminal-panel shadow-terminal-panel";

export const TERMINAL_PANEL_MUTED =
  "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/80 shadow-terminal-panel";

export const TERMINAL_CARD =
  "rounded-lg border border-terminal-border bg-terminal-panel shadow-terminal-panel";

export const TERMINAL_CARD_HOVER =
  "rounded-lg border border-terminal-borderMuted bg-terminal-panel shadow-terminal-panel transition hover:border-terminal-cyan/35 hover:shadow-terminal-glow";

export const TERMINAL_SECTION_TITLE =
  "text-[11px] font-semibold uppercase tracking-widest text-terminal-textMuted";

export const TERMINAL_TEXT_MUTED = "text-sm text-terminal-textMuted";

export const TERMINAL_INPUT =
  "w-full rounded-md border border-terminal-borderMuted bg-terminal-panelSecondary/80 px-3 py-2 text-sm text-terminal-text outline-none transition placeholder:text-terminal-textMuted focus:border-terminal-cyan/50 focus:ring-2 focus:ring-terminal-cyan/20";

export const TERMINAL_BUTTON_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-terminal-cyan px-4 py-2 text-sm font-semibold text-terminal-buttonText shadow-[0_4px_20px_rgba(34,211,238,0.3)] transition hover:bg-terminal-cyanStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan/40 disabled:pointer-events-none disabled:opacity-50";

export const TERMINAL_BUTTON_SECONDARY =
  "inline-flex items-center justify-center rounded-md border border-terminal-borderMuted bg-terminal-panelSecondary px-4 py-2 text-sm font-semibold text-terminal-text transition hover:border-terminal-cyan/40 hover:bg-terminal-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan/40 disabled:pointer-events-none disabled:opacity-50";

export const TERMINAL_BADGE =
  "inline-flex items-center rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-terminal-textSecondary";

export const TERMINAL_DANGER_TEXT = "text-terminal-negative";

export const TERMINAL_SUCCESS_TEXT = "text-terminal-positive";

/** App shell chrome (navbar, mobile nav, overlays). */
export const TERMINAL_NAV_SHELL =
  "sticky top-0 z-20 border-b border-terminal-border bg-terminal-bg/92 shadow-terminal-panel backdrop-blur-xl";

export const TERMINAL_NAV_LINK_BASE =
  "whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition-all duration-200 lg:px-2.5 lg:text-sm";

export const TERMINAL_NAV_LINK_ACTIVE =
  "bg-terminal-cyan/15 text-terminal-cyan shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]";

export const TERMINAL_NAV_LINK_IDLE =
  "text-terminal-textSecondary hover:bg-terminal-panelSecondary/80 hover:text-terminal-text";

export const TERMINAL_DROPDOWN_PANEL =
  "rounded-lg border border-terminal-border bg-terminal-panel py-1 shadow-terminal-panel backdrop-blur-md";

export const TERMINAL_MOBILE_BOTTOM_NAV =
  "fixed bottom-0 left-0 right-0 z-20 border-t border-terminal-border bg-terminal-bg/92 backdrop-blur-xl md:hidden";

export const TERMINAL_SHELL_OVERLAY = "fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 md:hidden";

export const TERMINAL_MOBILE_DRAWER =
  "fixed right-0 top-0 z-40 flex h-dvh w-[min(88vw,22rem)] flex-col border-l border-terminal-border bg-terminal-panel shadow-terminal-panel transition-transform duration-300 md:hidden";

export const TERMINAL_SEARCH_DROPDOWN =
  "absolute z-30 mt-2 w-full rounded-lg border border-terminal-border bg-terminal-panel py-2 shadow-terminal-panel backdrop-blur-md";

export const TERMINAL_ICON_BUTTON =
  "inline-flex items-center justify-center rounded-md border border-terminal-borderMuted bg-terminal-panelSecondary/70 text-terminal-textSecondary transition hover:border-terminal-cyan/35 hover:text-terminal-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan/40";
