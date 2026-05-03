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

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EodhdFetchOptions {
  symbol: string;
  range?: string;
  period?: "d" | "w" | "m";
}

export type ScraperOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; source: ScraperSource; message: string; status?: number };

/** Normalized Finnhub /stock/profile2 payload */
export interface CompanyProfile {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  logoUrl?: string | null;
  webUrl?: string | null;
  description?: string | null;
}

/** Subset of Telegram Bot API message fields used by our handlers */
export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot?: boolean; first_name?: string; username?: string };
  text?: string;
  date: number;
}
