export function formatCurrency(value: number, currency = "PLN"): string {
  const normalized = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "PLN";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: normalized,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
