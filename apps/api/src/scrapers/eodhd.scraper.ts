import process from "node:process";
import type { EodhdFetchOptions, OhlcvBar } from "../types/scraper.types";

const BASE = "https://api.eodhistoricaldata.com/api/eod";

function mapRow(row: Record<string, unknown>): OhlcvBar {
  return {
    date: String(row.date),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

/** Daily OHLCV from EOD Historical Data. */
export async function fetchEodhdDaily(options: EodhdFetchOptions): Promise<OhlcvBar[]> {
  const token = process.env.EODHD_API_KEY;
  if (!token) {
    throw new Error("EODHD_API_KEY is not set");
  }

  const range = options.range ?? "1m";
  const period = options.period ?? "d";
  const symbol = options.symbol;

  const params = new URLSearchParams({
    api_token: token,
    period,
    fmt: "json",
    range,
  });

  const url = `${BASE}/${encodeURIComponent(symbol)}?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`EODHD HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`EODHD invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`EODHD unexpected payload: ${text.slice(0, 300)}`);
  }

  return parsed.map((row) => mapRow(row as Record<string, unknown>));
}
