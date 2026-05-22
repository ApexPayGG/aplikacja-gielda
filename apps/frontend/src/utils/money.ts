import { resolveIntlLocale } from "./formatters";

export function formatCurrency(value: number, currency = "USD", language?: string): string {
  const normalized = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "USD";
  const locale = resolveIntlLocale(language);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalized,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
