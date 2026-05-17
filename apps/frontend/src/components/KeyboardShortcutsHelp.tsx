import { useEffect, useState } from "react";
import {
  KEYBOARD_SHORTCUTS_ESCAPE_EVENT,
  KEYBOARD_SHORTCUTS_HELP_EVENT,
  KEYBOARD_SHORTCUTS_HELP_ITEMS,
} from "../utils/keyboardShortcuts";

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openHelp = () => setOpen(true);
    const closeHelp = () => setOpen(false);

    window.addEventListener(KEYBOARD_SHORTCUTS_HELP_EVENT, openHelp);
    window.addEventListener(KEYBOARD_SHORTCUTS_ESCAPE_EVENT, closeHelp);
    return () => {
      window.removeEventListener(KEYBOARD_SHORTCUTS_HELP_EVENT, openHelp);
      window.removeEventListener(KEYBOARD_SHORTCUTS_ESCAPE_EVENT, closeHelp);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Zamknij skróty"
        className="absolute inset-0 bg-bgPrimary/60 shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]"
        onClick={() => setOpen(false)}
      />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-bgPrimary p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-textPrimary">Keyboard shortcuts</h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-textSecondary transition hover:text-brandDark"
            onClick={() => setOpen(false)}
            aria-label="Zamknij"
          >
            X
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <tbody>
              {KEYBOARD_SHORTCUTS_HELP_ITEMS.map((shortcut) => (
                <tr key={shortcut.key} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-brandDark px-2.5 py-1 font-mono text-xs font-semibold text-white">
                      {shortcut.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-textSecondary">{shortcut.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
