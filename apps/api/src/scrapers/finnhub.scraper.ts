import process from "node:process";
import type { FinnhubDetailedQuote, FinnhubNewsItem, MarketQuote } from "../types/scraper.types";

const BASE = "https://finnhub.io/api/v1";

interface FinnhubQuoteJson {
  c?: number;
  t?: number;
  o?: number;
  h?: number;
  l?: number;
  v?: number;
}

function finnhubTimeToMs(t: number): number {
  return t < 1e12 ? t * 1000 : t;
}

async function loadFinnhubQuoteDetailed(symbol: string): Promise<FinnhubDetailedQuote> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY is not set");

  const url = `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as FinnhubQuoteJson;
  const price = data.c;
  const rawT = data.t;
  if (price == null || rawT == null) throw new Error(`Finnhub unexpected: ${JSON.stringify(data)}`);

  const close = price;
  const open = data.o ?? close;
  const high = data.h ?? close;
  const low = data.l ?? close;
  const volume = data.v != null && !Number.isNaN(data.v) ? Math.round(data.v) : 0;

  return {
    symbol: symbol.toUpperCase(),
    source: "finnhub",
    price: close,
    timestampMs: finnhubTimeToMs(rawT),
    open,
    high,
    low,
    close,
    volume,
  };
}

export async function fetchFinnhubQuote(symbol: string): Promise<MarketQuote> {
  const d = await loadFinnhubQuoteDetailed(symbol);
  return { symbol: d.symbol, source: d.source, price: d.price, timestampMs: d.timestampMs, currency: d.currency };
}

export async function fetchFinnhubQuoteDetailed(symbol: string): Promise<FinnhubDetailedQuote> {
  return loadFinnhubQuoteDetailed(symbol);
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchFinnhubCompanyNews(symbol: string, days = 7): Promise<FinnhubNewsItem[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY is not set");

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);

  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    from: toYmd(from),
    to: toYmd(to),
    token,
  });

  const url = `${BASE}/company-news?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub company-news HTTP ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as FinnhubNewsItem[];
  if (!Array.isArray(data)) throw new Error(`Finnhub company-news unexpected: ${JSON.stringify(data)}`);
  return data;
}
