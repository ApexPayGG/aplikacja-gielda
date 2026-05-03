export type ScraperSource = "finnhub" | "alpha_vantage" | "eodhd";

export interface MarketQuote {
  symbol: string;
  source: ScraperSource;
  price: number;
  timestampMs: number;
  currency?: string;
}

export interface FinnhubDetailedQuote extends MarketQuote {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinnhubNewsItem {
  datetime: number;
  headline: string;
  url: string;
  source: string;
  summary?: string;
}

export interface AlphaVantageIndicatorPoint {
  symbol: string;
  indicator: string;
  date: string;
  value: number;
}
