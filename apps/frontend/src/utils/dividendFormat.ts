const SUFFIX_CURRENCY: Record<string, string> = {
  US: "USD",
  WAR: "PLN",
  LSE: "GBP",
  XETRA: "EUR",
  DE: "EUR",
  PA: "EUR",
  AS: "EUR",
  MI: "EUR",
  MC: "EUR",
  SW: "CHF",
  KO: "KRW",
  HK: "HKD",
  T: "JPY",
};

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed.length !== 3) return null;
  return trimmed;
}

/** Infer ISO 4217 currency from symbol suffix, exchange hint, or explicit API field. */
export function inferCurrencyFromSymbol(
  symbol: string,
  options?: { exchange?: string | null; currency?: string | null },
): string {
  const explicit = normalizeCurrencyCode(options?.currency ?? null);
  if (explicit) return explicit;

  const normalized = symbol.trim().toUpperCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex > 0) {
    const suffix = normalized.slice(dotIndex + 1);
    const mapped = SUFFIX_CURRENCY[suffix];
    if (mapped) return mapped;
  }

  const exchange = (options?.exchange ?? "").trim().toUpperCase();
  if (exchange.includes("WARSAW") || exchange.includes("GPW") || exchange === "WAR") return "PLN";
  if (exchange.includes("LSE") || exchange.includes("LONDON")) return "GBP";
  if (exchange.includes("XETRA") || exchange.includes("FRA") || exchange.includes("XETR")) return "EUR";
  if (exchange.includes("KRX") || exchange.includes("KOREA")) return "KRW";
  if (exchange.includes("HKEX") || exchange.includes("HONG KONG")) return "HKD";
  if (exchange.includes("TSE") || exchange.includes("TOKYO") || exchange === "JP") return "JPY";

  return "USD";
}

export type DividendEventPayload = {
  dividendPerShare?: number | null;
  currency?: string | null;
};

export function readDividendPayload(payload: unknown): DividendEventPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const rawAmount = record.dividendPerShare ?? record.amount ?? record.amountPerShare;
  const dividendPerShare =
    typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? rawAmount
      : typeof rawAmount === "string" && rawAmount.trim() !== ""
        ? Number(rawAmount)
        : null;
  const currency = typeof record.currency === "string" ? record.currency : null;
  if (dividendPerShare == null && !currency) return null;
  return {
    dividendPerShare: Number.isFinite(dividendPerShare) ? dividendPerShare : null,
    currency,
  };
}

/** e.g. "0.91 USD", "8.00 PLN" — no $ prefix. */
export function formatDividendPerShareAmount(
  value: number | null | undefined,
  symbol: string,
  options?: { exchange?: string | null; currency?: string | null; decimals?: number },
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const decimals = options?.decimals ?? (value < 1 ? 2 : 2);
  const currency = inferCurrencyFromSymbol(symbol, options);
  return `${value.toFixed(decimals)} ${currency}`;
}
