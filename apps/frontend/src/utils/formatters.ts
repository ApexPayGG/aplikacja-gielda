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

/** Maps i18next language code to BCP 47 locale for Intl formatters. */
export function resolveIntlLocale(language?: string): string {
  const normalized = (language ?? "en").trim().toLowerCase();
  if (normalized.startsWith("pl")) return "pl-PL";
  if (normalized.startsWith("en")) return "en-US";
  return normalized.includes("-") ? normalized : `${normalized}-${normalized.toUpperCase()}`;
}

function toValidDate(date: string | Date | number | undefined): Date | null {
  if (date == null) return null;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLocaleMonthYear(date: string | Date | number | undefined, language?: string): string {
  const parsed = toValidDate(date);
  if (!parsed) return "n/a";
  return parsed.toLocaleDateString(resolveIntlLocale(language), { month: "long", year: "numeric" });
}

export function formatLocaleLongDate(date: string | Date | number | undefined, language?: string): string {
  const parsed = toValidDate(date);
  if (!parsed) return "n/a";
  return parsed.toLocaleDateString(resolveIntlLocale(language), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatLocaleDateTime(date: string | Date | number | undefined, language?: string): string {
  const parsed = toValidDate(date);
  if (!parsed) return "n/a";
  return parsed.toLocaleString(resolveIntlLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(date: string | Date | number | undefined, locale = "en-US"): string {
  const parsed = toValidDate(date);
  if (!parsed) return "n/a";
  return parsed.toLocaleString(resolveIntlLocale(locale));
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
