export const KEYBOARD_SHORTCUTS_HELP_EVENT = "stockai:keyboard-shortcuts-help";
export const KEYBOARD_SHORTCUTS_ESCAPE_EVENT = "stockai:keyboard-shortcuts-escape";

export const KEYBOARD_SEQUENCE_TIMEOUT_MS = 1200;

export const GO_SHORTCUTS: Readonly<Record<string, string>> = {
  h: "/dashboard",
  s: "/signals",
  c: "/companies",
  p: "/paper-trading",
  a: "/alpaca",
};

export const SEARCH_SHORTCUT_SELECTORS = [
  "input[data-shortcut-search='true']",
  "[data-shortcut-search='true'] input",
  "input[type='search']",
] as const;

export type KeyboardShortcutHelpItem = {
  key: string;
  description: string;
};

export const KEYBOARD_SHORTCUTS_HELP_ITEMS: ReadonlyArray<KeyboardShortcutHelpItem> = [
  { key: "G + H", description: "Go Home" },
  { key: "G + S", description: "Go Signals" },
  { key: "G + C", description: "Go Companies" },
  { key: "G + P", description: "Go Paper Trading" },
  { key: "G + A", description: "Go Alpaca" },
  { key: "/", description: "Focus search bar" },
  { key: "Escape", description: "Zamknij dropdown/modal" },
  { key: "?", description: "Pokaż shortcuts help" },
];
