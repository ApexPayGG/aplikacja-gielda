import process from "node:process";
import type { CompanyProfile } from "../types/scraper.types";

const BASE = "https://finnhub.io/api/v1";

interface FinnhubProfile2Json {
  name?: string;
  ticker?: string;
  finnhubIndustry?: string;
  industry?: string;
  sector?: string;
  logo?: string;
  weburl?: string;
  description?: string;
}

/**
 * Finnhub company fundamentals-style profile (`/stock/profile2`).
 */
export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  const url = `${BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub profile2 HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as FinnhubProfile2Json;
  const sym = (data.ticker ?? symbol).toUpperCase();
  const name = data.name?.trim() || sym;
  const sector = (data.sector ?? data.finnhubIndustry ?? data.industry ?? "Unknown").trim() || "Unknown";
  const industry = (data.industry ?? data.finnhubIndustry ?? sector).trim() || "Unknown";

  return {
    symbol: sym,
    name,
    sector,
    industry,
    logoUrl: data.logo ?? null,
    webUrl: data.weburl ?? null,
    description: data.description?.trim() ? data.description.trim() : null,
  };
}
