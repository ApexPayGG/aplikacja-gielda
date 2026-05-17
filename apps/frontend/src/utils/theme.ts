export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(storedTheme)) {
    return storedTheme;
  }
  return "light";
}

export function setTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyThemeClass(theme);
}

export function toggleTheme(): void {
  const nextTheme = getTheme() === "dark" ? "light" : "dark";
  setTheme(nextTheme);
}
