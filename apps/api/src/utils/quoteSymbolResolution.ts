/** Minimum bars for chart/signal history fallbacks (MARKET-DATA-READY.1A). */
export const MIN_QUOTE_HISTORY_BARS = 10;

/** Base ticker without exchange suffix (AAPL.US → AAPL). */
export function baseTickerFromSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  const dot = normalized.indexOf(".");
  return dot > 0 ? normalized.slice(0, dot) : normalized;
}

export function hasExchangeSuffix(symbol: string): boolean {
  return symbol.trim().includes(".");
}

/** EODHD-style suffix for a company exchange code (US / WAR / XETRA only). */
export function eodhdSuffixFromExchange(exchange: string | null | undefined): string | null {
  if (!exchange) return null;
  const cleaned = exchange.trim().toUpperCase().replace(/^\.+/, "");
  if (!cleaned) return null;
  if (["WAR", "GPW", "WSE"].includes(cleaned)) return "WAR";
  if (["XETRA", "GERMANY", "DE", "DAX"].includes(cleaned)) return "XETRA";
  if (["US", "NASDAQ", "NYSE", "AMEX"].includes(cleaned)) return "US";
  return null;
}

/**
 * Ordered symbol candidates for quote/history lookup.
 * Covers US large caps (base + .US), GPW (.WAR), DAX/XETRA (.XETRA).
 */
export function buildQuoteSymbolCandidates(ticker: string, exchange?: string | null): string[] {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return [];

  const out: string[] = [];
  const push = (value: string) => {
    const v = value.trim().toUpperCase();
    if (v && !out.includes(v)) out.push(v);
  };

  const base = baseTickerFromSymbol(normalized);
  push(normalized);
  if (base !== normalized) push(base);

  const suffixFromExchange = eodhdSuffixFromExchange(exchange);
  if (suffixFromExchange) push(`${base}.${suffixFromExchange}`);

  if (!normalized.endsWith(".US")) push(`${base}.US`);

  return out;
}

/** EODHD API symbol: no double suffix; WAR/XETRA when exchange known; else .US. */
export function toEodhdSymbolFromTicker(ticker: string, exchange?: string | null): string {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return "";
  if (hasExchangeSuffix(normalized)) return normalized;
  const suffix = eodhdSuffixFromExchange(exchange) ?? "US";
  return `${baseTickerFromSymbol(normalized)}.${suffix}`;
}
