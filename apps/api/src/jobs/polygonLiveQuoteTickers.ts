import type pino from "pino";
import type { PolygonClient } from "../../../../packages/data/src/polygon/client";

export type PolygonLiveQuoteTickerSource = "env_symbols" | "polygon_reference";

/**
 * Parse POLYGON_LIVE_QUOTES_SYMBOLS: comma-separated, trim, uppercase, dedupe, drop empty.
 * Applies optional topLimit cap (POLYGON_TOP_STOCKS_LIMIT).
 */
export function parsePolygonLiveQuoteSymbols(raw: string | undefined, topLimit: number): string[] {
  if (raw === undefined || raw.trim() === "") return [];
  const cap = Math.max(1, Math.floor(topLimit) || 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const ticker = part.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push(ticker);
    if (out.length >= cap) break;
  }
  return out;
}

export function isPolygonLiveQuoteSymbolsEnvConfigured(raw: string | undefined): boolean {
  return raw !== undefined && raw.trim() !== "";
}

export type ResolvePolygonLiveQuoteTickersInput = {
  symbolsEnv?: string;
  topLimit: number;
  traceId: string;
  polygon: Pick<PolygonClient, "getTopStocks">;
  logger: pino.Logger;
};

/**
 * Launch universe from env when POLYGON_LIVE_QUOTES_SYMBOLS is set; otherwise Polygon reference tickers (alphabetical).
 */
export async function resolvePolygonLiveQuoteTickers(
  input: ResolvePolygonLiveQuoteTickersInput,
): Promise<{ tickers: string[]; source: PolygonLiveQuoteTickerSource }> {
  const envRaw = input.symbolsEnv ?? process.env.POLYGON_LIVE_QUOTES_SYMBOLS;

  if (isPolygonLiveQuoteSymbolsEnvConfigured(envRaw)) {
    const parsed = parsePolygonLiveQuoteSymbols(envRaw, input.topLimit);
    if (parsed.length > 0) {
      input.logger.info({
        msg: "polygon_live_quotes_symbols_override",
        traceId: input.traceId,
        count: parsed.length,
      });
      return { tickers: parsed, source: "env_symbols" };
    }
    input.logger.warn(
      { msg: "polygon_live_quotes_symbols_empty_after_parse", traceId: input.traceId },
      "POLYGON_LIVE_QUOTES_SYMBOLS set but empty after parse; fallback to polygon reference tickers",
    );
  }

  const tickers = await input.polygon.getTopStocks(input.topLimit, input.traceId);
  input.logger.info({
    msg: "polygon_reference_tickers_loaded",
    traceId: input.traceId,
    count: tickers.length,
  });
  return { tickers, source: "polygon_reference" };
}
