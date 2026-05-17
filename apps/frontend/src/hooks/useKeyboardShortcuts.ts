import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  GO_SHORTCUTS,
  KEYBOARD_SEQUENCE_TIMEOUT_MS,
  KEYBOARD_SHORTCUTS_ESCAPE_EVENT,
  KEYBOARD_SHORTCUTS_HELP_EVENT,
  SEARCH_SHORTCUT_SELECTORS,
} from "../utils/keyboardShortcuts";

function hasModifierKey(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    target.closest("[contenteditable='true']") !== null
  );
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).visibility !== "hidden";
}

function focusFirstSearchInput(): void {
  for (const selector of SEARCH_SHORTCUT_SELECTORS) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const match = candidates.find((element) => isVisible(element));
    if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) {
      match.focus();
      match.select();
      return;
    }
  }
}

function isQuestionMarkShortcut(event: KeyboardEvent): boolean {
  return event.key === "?" || (event.key === "/" && event.shiftKey);
}

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const waitingForGoSuffixRef = useRef(false);
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const clearGoSequence = (): void => {
      waitingForGoSuffixRef.current = false;
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        window.dispatchEvent(new Event(KEYBOARD_SHORTCUTS_ESCAPE_EVENT));
        clearGoSequence();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();

      if (waitingForGoSuffixRef.current) {
        const targetPath = GO_SHORTCUTS[normalizedKey];
        clearGoSequence();
        if (!hasModifierKey(event) && targetPath) {
          event.preventDefault();
          navigate(targetPath);
          return;
        }
      }

      if (isQuestionMarkShortcut(event) && !hasModifierKey(event)) {
        event.preventDefault();
        window.dispatchEvent(new Event(KEYBOARD_SHORTCUTS_HELP_EVENT));
        return;
      }

      if (hasModifierKey(event)) {
        return;
      }

      if (normalizedKey === "g") {
        event.preventDefault();
        waitingForGoSuffixRef.current = true;
        resetTimeoutRef.current = window.setTimeout(() => {
          waitingForGoSuffixRef.current = false;
          resetTimeoutRef.current = null;
        }, KEYBOARD_SEQUENCE_TIMEOUT_MS);
        return;
      }

      if (normalizedKey === "/") {
        event.preventDefault();
        focusFirstSearchInput();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearGoSequence();
    };
  }, [navigate]);
}
