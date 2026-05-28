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

export const TERMINAL_FILTER_PANEL = `${TERMINAL_PANEL} space-y-5 p-4 sm:p-5`;

export const TERMINAL_COMPANY_CARD =
  "group relative flex flex-col overflow-hidden rounded-lg border border-terminal-border bg-terminal-panel shadow-terminal-panel transition hover:-translate-y-0.5 hover:border-terminal-cyan/35 hover:shadow-terminal-glow";

export const TERMINAL_LINK_ACCENT =
  "font-semibold text-terminal-cyan underline decoration-terminal-cyan/40 underline-offset-2 transition hover:decoration-terminal-cyan";

export const TERMINAL_PAGE_TITLE = "text-2xl font-bold tracking-tight text-terminal-text md:text-3xl";

export const TERMINAL_PAGE_SUBTITLE = "mt-2 max-w-3xl text-sm text-terminal-textSecondary";

export const TERMINAL_DRAWER_PANEL =
  "relative flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-terminal-border bg-terminal-panel shadow-terminal-panel md:h-dvh md:max-h-none md:max-w-lg md:rounded-none md:rounded-l-2xl md:border-b md:border-l md:shadow-[-12px_0_40px_rgba(2,6,23,0.55)]";

/** Signals / market intelligence cockpit */
export const TERMINAL_SIGNAL_PANEL = `${TERMINAL_PANEL} p-4 sm:p-5`;

export const TERMINAL_SIGNAL_CARD =
  "rounded-lg border border-terminal-border bg-terminal-panel p-4 shadow-terminal-panel transition sm:p-5";

export const TERMINAL_SIGNAL_CARD_HOVER = "border-terminal-cyan/40 shadow-terminal-glow";

export const TERMINAL_SIGNAL_ROW =
  "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/50";

export const TERMINAL_SIGNAL_INNER = "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60";

export const TERMINAL_SIGNAL_BADGE =
  "inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide";

export const TERMINAL_METRIC_TILE = `${TERMINAL_PANEL_MUTED} p-3 sm:p-4`;

export const TERMINAL_FILTER_CHIP =
  "rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 py-1.5 text-xs font-semibold text-terminal-textSecondary transition hover:border-terminal-cyan/30 hover:text-terminal-text";

export const TERMINAL_FILTER_CHIP_ACTIVE =
  "rounded-full border border-terminal-cyan/50 bg-terminal-cyan/15 px-3 py-1.5 text-xs font-semibold text-terminal-cyan";

export const TERMINAL_LIVE_STATUS =
  "inline-flex items-center gap-1.5 rounded-full border border-terminal-cyan/30 bg-terminal-cyan/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-terminal-cyan";

export const TERMINAL_MOBILE_FILTER_SHEET =
  "absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-2xl border border-terminal-border bg-terminal-panel p-4 shadow-terminal-panel backdrop-blur-xl";

/** Public marketing landing (`/`) — dark institutional fintech, aligned with cockpit brand */
export const TERMINAL_LANDING_BG =
  "min-h-screen bg-terminal-bg text-terminal-text antialiased";

export const TERMINAL_LANDING_SECTION =
  "relative scroll-mt-24 overflow-hidden px-4 py-16 sm:py-20";

export const TERMINAL_LANDING_EYEBROW =
  "inline-flex items-center rounded-full border border-terminal-cyan/30 bg-terminal-cyan/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-terminal-cyan";

export const TERMINAL_HERO_PANEL =
  "rounded-xl border border-terminal-border bg-terminal-panel shadow-terminal-panel";

export const TERMINAL_HERO_GRID =
  "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/70 p-3 transition hover:border-terminal-cyan/25 hover:bg-terminal-panelSecondary";

export const TERMINAL_PROOF_CARD =
  "rounded-xl border border-terminal-border bg-terminal-panel shadow-terminal-panel transition duration-300 hover:border-terminal-cyan/30 hover:shadow-terminal-glow";

export const TERMINAL_PRICING_PREVIEW_CARD =
  "rounded-xl border border-terminal-border bg-terminal-panel p-6 shadow-terminal-panel sm:p-8";

export const TERMINAL_LANDING_CTA_PRIMARY =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-terminal-cyan px-6 py-3.5 text-base font-semibold text-terminal-buttonText shadow-[0_4px_24px_rgba(34,211,238,0.35)] transition hover:bg-terminal-cyanStrong sm:w-auto sm:px-8 sm:py-4 sm:text-lg";

export const TERMINAL_LANDING_CTA_SECONDARY =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-6 py-3.5 text-base font-semibold text-terminal-cyan transition hover:border-terminal-cyan/40 hover:bg-terminal-panel sm:w-auto sm:px-8 sm:py-4 sm:text-lg";
