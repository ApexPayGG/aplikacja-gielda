/** Market data provider id */
export type ScraperSource = "finnhub" | "alpha_vantage" | "eodhd";

/** Normalized last price + time */
export interface MarketQuote {
  symbol: string;
  source: ScraperSource;
  price: number;
  /** Unix timestamp in milliseconds */
  timestampMs: number;
  currency?: string;
}

/** Finnhub `/quote` with OHLC + volume for DB inserts */
export interface FinnhubDetailedQuote extends MarketQuote {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Finnhub company-news item */
export interface FinnhubNewsItem {
  datetime: number;
  headline: string;
  url: string;
  source: string;
  summary?: string;
}

/** Latest technical indicator reading from Alpha Vantage */
export interface AlphaVantageIndicatorPoint {
  symbol: string;
  indicator: string;
  date: string;
  value: number;
}

/** OHLCV bar (daily or as returned by the API) */
export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Options for EODHD daily history */
export interface EodhdFetchOptions {
  symbol: string;
  /** API `range` parameter, e.g. `1m` */
  range?: string;
  period?: "d" | "w" | "m";
}

/** Result wrapper for orchestrator partial failures */
export type ScraperOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; source: ScraperSource; message: string; status?: number };
