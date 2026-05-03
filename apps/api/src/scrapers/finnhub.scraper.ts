import process from "node:process";
import type { MarketQuote } from "../types/scraper.types";

const BASE = "https://finnhub.io/api/v1";

interface FinnhubQuoteJson {
  c?: number;
  t?: number;
}

function finnhubTimeToMs(t: number): number {
  return t < 1e12 ? t * 1000 : t;
}

/** Last quote from Finnhub `/quote` endpoint. */
export async function fetchFinnhubQuote(symbol: string): Promise<MarketQuote> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as FinnhubQuoteJson;
  const price = data.c;
  const rawT = data.t;
  if (price == null || rawT == null) {
    throw new Error(`Finnhub unexpected payload: ${JSON.stringify(data)}`);
  }

  return {
    symbol: symbol.toUpperCase(),
    source: "finnhub",
    price,
    timestampMs: finnhubTimeToMs(rawT),
  };
}
