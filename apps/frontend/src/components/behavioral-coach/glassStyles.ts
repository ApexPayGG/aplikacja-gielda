/**
 * @deprecated Prefer `terminal/terminalStyles` for new authenticated UI.
 * Coach / paper surfaces: aliases to institutional terminal tokens (no glass blur / purple default).
 */
import {
  TERMINAL_APP_BG,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_COACH_CARD,
  TERMINAL_COACH_PANEL,
  TERMINAL_COMPANY_CARD,
  TERMINAL_FILTER_PANEL,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_LINK_ACCENT,
  TERMINAL_METRIC_TILE,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SECTION_TITLE,
  TERMINAL_SIGNAL_CARD,
  TERMINAL_SUCCESS_TEXT,
  TERMINAL_DANGER_TEXT,
} from "../terminal/terminalStyles";

export const GLASS_PAGE_BG = TERMINAL_APP_BG;

export const GLASS_SECTION = TERMINAL_COACH_PANEL;

export const GLASS_SECTION_TITLE = TERMINAL_SECTION_TITLE;

export const GLASS_HERO = `${TERMINAL_COACH_PANEL} border-terminal-cyan/25`;

export const GLASS_STAT_CARD = TERMINAL_METRIC_TILE;

export const GLASS_INNER_PANEL = TERMINAL_COACH_CARD;

export const GLASS_WATCHLIST_CARD = TERMINAL_COACH_CARD;

export const GLASS_WIDGET_SHELL = TERMINAL_COACH_PANEL;

export const GLASS_BTN_PRIMARY = TERMINAL_BUTTON_PRIMARY;

export const GLASS_BTN_SECONDARY = TERMINAL_BUTTON_SECONDARY;

export const GLASS_BTN_GHOST =
  "inline-flex items-center justify-center rounded-md border border-terminal-cyan/35 px-4 py-2.5 text-sm font-semibold text-terminal-cyan transition hover:bg-terminal-cyan/10";

export const GLASS_LINK_ACCENT = TERMINAL_LINK_ACCENT;

export const GLASS_PAGE_TITLE = TERMINAL_PAGE_TITLE;

export const GLASS_PAGE_SUBTITLE = TERMINAL_PAGE_SUBTITLE;

export const GLASS_FILTER_PANEL = TERMINAL_FILTER_PANEL;

export const GLASS_INPUT = TERMINAL_INPUT;

export const GLASS_SELECT = TERMINAL_INPUT;

export const GLASS_LABEL = TERMINAL_FORM_LABEL;

export const GLASS_COMPANY_CARD = TERMINAL_COMPANY_CARD;

export const GLASS_SIGNAL_CARD = TERMINAL_SIGNAL_CARD;

export const GLASS_TEXT_POSITIVE = TERMINAL_SUCCESS_TEXT;

export const GLASS_TEXT_NEGATIVE = TERMINAL_DANGER_TEXT;
