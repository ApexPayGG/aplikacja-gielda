import axios, { AxiosError } from "axios";
import type { DividendAlertsResponse, DividendIntelligence, SectorComparison } from "../types/dividend";

/** Dev proxy uses `VITE_API_BASE=/api`. If env is only origin (no `/api`), append it so paths like `/position-size/calculate` resolve correctly. */
function normalizeApiBase(raw: string | undefined): string {
  const fallback = "http://localhost:3000/api";
  if (raw == null || String(raw).trim() === "") return fallback;
  const s = String(raw).trim();
  if (s.startsWith("/")) return s;
  try {
    const url = new URL(s);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/") {
      url.pathname = "/api";
      return url.href.replace(/\/+$/, "");
    }
    return url.href.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

const baseURL = normalizeApiBase(import.meta.env.VITE_API_BASE as string | undefined);

export const api = axios.create({
  baseURL,
  headers: { Accept: "application/json" },
  timeout: 60_000,
});

export interface Company {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  logoUrl: string | null;
  description: string | null;
  webUrl: string | null;
  createdAt: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  data: Company[];
}

export interface SectorListResponse {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuoteRow {
  id: string;
  symbol: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  source: string;
}

export interface QuoteHistoryResponse {
  symbol: string;
  days: number;
  count: number;
  data: QuoteRow[];
}

export interface NewsRow {
  id: string;
  symbol: string;
  timestamp: string;
  title: string;
  url: string;
  sentiment: string | null;
  source: string;
}

export interface NewsListResponse {
  symbol: string;
  limit: number;
  count: number;
  data: NewsRow[];
}

export interface BriefSection {
  lang: string;
  body: string;
}

export interface AnalysisResponse {
  brief: string;
  updatedAt: string;
  requestedLang?: string;
  sections?: BriefSection[];
}

export interface BehavioralCooldownResponse {
  active: boolean;
  lossStreak: number;
  unlocksAt: string | null;
  message: string;
}

export type MistakeType = "EMOTIONAL" | "STRATEGY" | "TIMING";

export interface MistakeLibraryItem {
  id: string;
  symbol: string;
  pnl: number;
  type: MistakeType;
  explanation: string;
  createdAt: string;
}

export interface MistakeLibraryResponse {
  mistakes: MistakeLibraryItem[];
  summary: {
    total: number;
    emotional: number;
    strategy: number;
    timing: number;
  };
}

export async function searchCompanies(query: string, limit = 20): Promise<Company[]> {
  const { data } = await api.get<SearchResponse>("/companies/search", {
    params: { q: query, limit },
  });
  return data.data;
}

export async function getCompanyBySector(
  sector: string,
  page = 1,
  pageSize = 20,
): Promise<SectorListResponse> {
  const encoded = encodeURIComponent(sector);
  const { data } = await api.get<SectorListResponse>(`/companies/sector/${encoded}`, {
    params: { page, pageSize },
  });
  return data;
}

export async function getCompanyDetail(symbol: string): Promise<Company> {
  const { data } = await api.get<Company>(`/companies/${encodeURIComponent(symbol)}`);
  return data;
}

export async function getQuoteHistory(symbol: string, days = 30): Promise<QuoteHistoryResponse> {
  const { data } = await api.get<QuoteHistoryResponse>(`/quotes/${encodeURIComponent(symbol)}/history`, {
    params: { days },
  });
  return data;
}

export async function getNews(symbol: string, limit = 10): Promise<NewsRow[]> {
  const { data } = await api.get<NewsListResponse>(`/news/${encodeURIComponent(symbol)}`, {
    params: { limit },
  });
  return data.data;
}

export async function getBehavioralCooldown(userId: string): Promise<BehavioralCooldownResponse> {
  const { data } = await api.get<BehavioralCooldownResponse>(`/behavioral/cooldown/${encodeURIComponent(userId)}`);
  return data;
}

export async function getBehavioralMistakes(userId: string): Promise<MistakeLibraryResponse> {
  const { data } = await api.get<MistakeLibraryResponse>(`/behavioral/mistakes/${encodeURIComponent(userId)}`);
  return data;
}

export async function analyzeBehavioralMistakes(userId: string): Promise<{ analyzed: number }> {
  const { data } = await api.post<{ analyzed: number }>(`/behavioral/mistakes/${encodeURIComponent(userId)}/analyze`);
  return data;
}

export async function getCompanyBrief(symbol: string, lang: string): Promise<AnalysisResponse> {
  try {
    const { data } = await api.get<AnalysisResponse>(`/companies/${encodeURIComponent(symbol)}/brief`, {
      params: { lang },
    });
    return data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      // Backward compatibility for API versions that don't expose /companies/:symbol/brief yet.
      const { data } = await api.get<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}`, {
        params: { lang },
      });
      return data;
    }
    throw error;
  }
}

/** @deprecated Prefer getCompanyBrief(symbol, lang) for i18n-aware briefs */
export async function getAnalysis(symbol: string, lang = "pl"): Promise<AnalysisResponse> {
  const { data } = await api.get<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}`, {
    params: { lang },
  });
  return data;
}

export interface DividendHistoryItem {
  exDate: string;
  payDate: string;
  amount: number;
  yield: number | null;
}

export interface DividendHistoryResponse {
  symbol: string;
  years: number;
  count: number;
  data: DividendHistoryItem[];
}

export async function getDividendHistory(symbol: string, years = 5): Promise<DividendHistoryResponse> {
  const { data } = await api.get<DividendHistoryResponse>(`/dividends/${encodeURIComponent(symbol)}`, {
    params: { years },
  });
  return data;
}

export interface DividendGrowthRow {
  symbol: string;
  latestYear: number;
  totalAmount: number;
  growthYoY: number | null;
  cagr5Y: number | null;
  cagr10Y: number | null;
  latestYield: number | null;
}

export interface DividendGrowthScreenerResponse {
  screenerCacheKeyVersion?: number;
  minYears: number;
  minYield: number;
  page: number;
  limit: number;
  total: number;
  count: number;
  data: DividendGrowthRow[];
  screenerDebug?: Record<string, unknown>;
  sqlDebug?: Record<string, unknown>;
}

export async function getDividendGrowthScreener(
  minYears = 5,
  minYield = 3,
  limit = 50,
  page = 1,
): Promise<DividendGrowthScreenerResponse> {
  const { data } = await api.get<DividendGrowthScreenerResponse>("/screeners/dividend/growth", {
    params: { minYears, minYield, limit, page },
  });
  return data;
}

export interface TaxPLResponse {
  grossDividend: number;
  taxAmount: number;
  netIncome: number;
  taxRate: number;
  method: string;
}

export async function calculateDividendTaxPL(body: {
  shares: number;
  currentPrice: number;
  dividendPerShare?: number;
  annualDividendYieldPercent?: number;
}): Promise<TaxPLResponse> {
  const { data } = await api.post<TaxPLResponse>("/dividends/tax-calculator-pl", body);
  return data;
}

/** `baseURL` już zawiera `/api` — ścieżka bez drugiego prefiksu. */
export const getDividendIntelligence = (symbol: string) =>
  api.get<DividendIntelligence>(`/intelligence/dividend/${encodeURIComponent(symbol)}`);

export const getDividendAlerts = (symbol: string, limit: number = 20) =>
  api.get<DividendAlertsResponse>(`/intelligence/dividend/${encodeURIComponent(symbol)}/alerts`, {
    params: { limit },
  });

export const getSectorComparison = () =>
  api.get<SectorComparison>("/intelligence/dividend/comparison/sector");

