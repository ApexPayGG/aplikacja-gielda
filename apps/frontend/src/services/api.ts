import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "http://localhost:3000/api";

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

export interface AnalysisResponse {
  brief: string;
  updatedAt: string;
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

export async function getAnalysis(symbol: string): Promise<AnalysisResponse> {
  const { data } = await api.get<AnalysisResponse>(`/analysis/${encodeURIComponent(symbol)}`);
  return data;
}
