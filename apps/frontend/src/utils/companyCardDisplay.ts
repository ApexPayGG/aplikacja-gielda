const PREMIUM_LOCKED_SYMBOLS = new Set([
  "GOOGL",
  "GOOGL.US",
  "AMZN",
  "AMZN.US",
  "AAPL",
  "AAPL.US",
  "MSFT",
  "MSFT.US",
  "META",
  "META.US",
  "NVDA",
  "NVDA.US",
  "TSLA",
  "TSLA.US",
]);

export function isPremiumLockedSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return false;
  if (PREMIUM_LOCKED_SYMBOLS.has(normalized)) return true;
  if (/\.US$/i.test(normalized)) return true;
  return false;
}

export function mockQuoteFromSymbol(symbol: string): { price: number; changePct: number } {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }

  const price = 8 + (hash % 49_200) / 100;
  const changePct = ((hash % 401) - 200) / 100;

  return {
    price: Math.round(price * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
  };
}

export function formatStockPrice(price: number, symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes(".SW") || upper.endsWith(".PL") || upper.includes("WAR")) {
    return `${price.toFixed(2)} PLN`;
  }
  if (upper.includes(".DE") || upper.includes(".PA") || upper.includes(".AS")) {
    return `€${price.toFixed(2)}`;
  }
  if (upper.includes(".L")) {
    return `£${price.toFixed(2)}`;
  }
  return `$${price.toFixed(2)}`;
}
