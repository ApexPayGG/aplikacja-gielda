import type { EodhdFetchOptions, MarketQuote, OhlcvBar, ScraperOutcome } from "../types/scraper.types";
import { fetchAlphaVantageGlobalQuote } from "./alpha-vantage.scraper";
import { fetchEodhdDaily } from "./eodhd.scraper";
import { fetchFinnhubQuote } from "./finnhub.scraper";

export interface OrchestratedQuotes {
  finnhub: ScraperOutcome<MarketQuote>;
  alphaVantage: ScraperOutcome<MarketQuote>;
}

function outcomeFromSettled(
  source: MarketQuote["source"],
  result: PromiseSettledResult<MarketQuote>,
): ScraperOutcome<MarketQuote> {
  if (result.status === "fulfilled") {
    return { ok: true, data: result.value };
  }
  const reason = result.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  return { ok: false, source, message };
}

export async function fetchQuotesParallel(symbol: string): Promise<OrchestratedQuotes> {
  const [fh, av] = await Promise.allSettled([fetchFinnhubQuote(symbol), fetchAlphaVantageGlobalQuote(symbol)]);
  return {
    finnhub: outcomeFromSettled("finnhub", fh),
    alphaVantage: outcomeFromSettled("alpha_vantage", av),
  };
}

export async function runScraperDemo(
  symbol: string,
  eodOptions?: EodhdFetchOptions,
): Promise<{
  quotes: OrchestratedQuotes;
  eodhd: ScraperOutcome<OhlcvBar[]>;
}> {
  const quotes = await fetchQuotesParallel(symbol);
  let eodhdResult: ScraperOutcome<OhlcvBar[]>;

  if (eodOptions) {
    try {
      const bars = await fetchEodhdDaily(eodOptions);
      eodhdResult = { ok: true, data: bars };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      eodhdResult = { ok: false, source: "eodhd", message };
    }
  } else {
    eodhdResult = { ok: false, source: "eodhd", message: "EODHD options not provided" };
  }

  return { quotes, eodhd: eodhdResult };
}
