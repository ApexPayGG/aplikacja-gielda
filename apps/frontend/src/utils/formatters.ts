function asFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(amount: number, currency: string): string {
  const parsedAmount = asFiniteNumber(amount);
  if (parsedAmount == null) return "—";
  const normalizedCurrency = currency?.trim().toUpperCase() || "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsedAmount);
}

export function formatPercent(value: number): string {
  const parsedValue = asFiniteNumber(value);
  if (parsedValue == null) return "—";
  return `${parsedValue >= 0 ? "+" : ""}${parsedValue.toFixed(2)}%`;
}

export function formatDate(date: string | Date | number | undefined, locale = "pl-PL"): string {
  if (date == null) return "n/a";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString(locale);
}

export function formatNumber(value: number, decimals = 2): string {
  const parsedValue = asFiniteNumber(value);
  if (parsedValue == null) return "—";
  const safeDecimals = Math.max(0, Math.min(6, Math.trunc(decimals)));
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: safeDecimals,
    maximumFractionDigits: safeDecimals,
  }).format(parsedValue);
}
