import process from "node:process";
import type { MarketQuote } from "../types/scraper.types";

const BASE = "https://www.alphavantage.co/query";

interface AlphaVantageGlobalQuote {
  "01. symbol"?: string;
  "05. price"?: string;
  "07. latest trading day"?: string;
}

interface AlphaVantageGlobalQuoteResponse {
  "Global Quote"?: AlphaVantageGlobalQuote;
  "Error Message"?: string;
  Note?: string;
}

function parseDayToUtcMs(day: string): number {
  const d = new Date(`${day}T00:00:00.000Z`);
  return d.getTime();
}

/** Alpha Vantage GLOBAL_QUOTE (last daily close). */
export async function fetchAlphaVantageGlobalQuote(symbol: string): Promise<MarketQuote> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_KEY is not set");
  }

  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: symbol.toUpperCase(),
    apikey: apiKey,
  });

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Alpha Vantage HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as AlphaVantageGlobalQuoteResponse;
  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage: ${data["Error Message"]}`);
  }
  if (data.Note) {
    throw new Error(`Alpha Vantage rate limit: ${data.Note}`);
  }

  const gq = data["Global Quote"];
  const priceStr = gq?.["05. price"];
  const sym = gq?.["01. symbol"] ?? symbol;
  const day = gq?.["07. latest trading day"];
  if (!priceStr || !day) {
    throw new Error(`Alpha Vantage unexpected payload: ${JSON.stringify(data)}`);
  }

  const price = Number(priceStr);
  if (Number.isNaN(price)) {
    throw new Error(`Alpha Vantage invalid price: ${priceStr}`);
  }

  return {
    symbol: sym.toUpperCase(),
    source: "alpha_vantage",
    price,
    timestampMs: parseDayToUtcMs(day),
  };
}
