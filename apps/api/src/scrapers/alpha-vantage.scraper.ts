import process from "node:process";
import type { AlphaVantageIndicatorPoint, MarketQuote } from "../types/scraper.types";

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
  return new Date(`${day}T00:00:00.000Z`).getTime();
}

export async function fetchAlphaVantageGlobalQuote(symbol: string): Promise<MarketQuote> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_KEY is not set");

  const params = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: symbol.toUpperCase(),
    apikey: apiKey,
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as AlphaVantageGlobalQuoteResponse;
  if (data["Error Message"]) throw new Error(`Alpha Vantage: ${data["Error Message"]}`);
  if (data.Note) throw new Error(`Alpha Vantage rate limit: ${data.Note}`);

  const gq = data["Global Quote"];
  const priceStr = gq?.["05. price"];
  const sym = gq?.["01. symbol"] ?? symbol;
  const day = gq?.["07. latest trading day"];
  if (!priceStr || !day) throw new Error(`Alpha Vantage unexpected: ${JSON.stringify(data)}`);

  const price = Number(priceStr);
  if (Number.isNaN(price)) throw new Error(`Alpha Vantage invalid price: ${priceStr}`);

  return {
    symbol: sym.toUpperCase(),
    source: "alpha_vantage",
    price,
    timestampMs: parseDayToUtcMs(day),
  };
}

export async function fetchAlphaVantageLatestRSI(
  symbol: string,
  timePeriod = 14,
): Promise<AlphaVantageIndicatorPoint> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_KEY is not set");

  const params = new URLSearchParams({
    function: "RSI",
    symbol: symbol.toUpperCase(),
    interval: "daily",
    time_period: String(timePeriod),
    series_type: "close",
    apikey: apiKey,
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data["Error Message"] === "string") throw new Error(`Alpha Vantage: ${data["Error Message"]}`);
  if (typeof data.Note === "string") throw new Error(`Alpha Vantage rate limit: ${data.Note}`);

  const series = data["Technical Analysis: RSI"] as Record<string, { RSI?: string }> | undefined;
  if (!series || typeof series !== "object") {
    throw new Error(`Alpha Vantage RSI unexpected: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
  const latestDate = dates[0];
  const rsiStr = series[latestDate]?.RSI;
  if (!latestDate || rsiStr == null) throw new Error("Alpha Vantage RSI empty series");

  const value = Number(rsiStr);
  if (Number.isNaN(value)) throw new Error(`Alpha Vantage RSI invalid: ${rsiStr}`);

  return { symbol: symbol.toUpperCase(), indicator: "RSI", date: latestDate, value };
}
