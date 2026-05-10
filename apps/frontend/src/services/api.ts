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

export interface NewsHalfLifeItem {
  headline: string;
  date: string;
  halfLifeDays: number;
  expiresAt: string;
  reason: string;
  category: string;
}

export interface NewsHalfLifeResponse {
  symbol: string;
  news: NewsHalfLifeItem[];
  mostImpactful: { headline: string; halfLifeDays: number } | null;
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

export type EmotionalLevel = "LOW" | "MEDIUM" | "HIGH";

export interface EmotionalTrackInput {
  userId: string;
  clickRate: number;
  tradeFrequency: number;
  avgDecisionTime: number;
}

export interface EmotionalTrackResponse {
  stressDetected: boolean;
  suggestion: string | null;
  level: EmotionalLevel;
}

export interface EmotionalStatusResponse {
  currentLevel: EmotionalLevel;
  suggestion: string | null;
  lastChecked: string | null;
}

export interface PreMortemInput {
  symbol: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  userId: string;
}

export interface PreMortemResponse {
  scenario: string;
  probability: number;
  maxLoss: number;
  marketRegime: string;
}

export type ReplayAction = "BUY" | "SELL";

export interface ReplaySnapshotResponse {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  priceChange5d: number;
}

export interface ReplayEvaluateBody {
  userId: string;
  symbol: string;
  date: string;
  action: ReplayAction;
  price: number;
}

export interface ReplayEvaluateResponse {
  score: number;
  explanation: string;
  actualOutcome: number;
}

export type StrategyDnaLegend = "BUFFETT" | "LYNCH" | "GREENBLATT" | "SOROS";

export interface StrategyDnaMatch {
  name: StrategyDnaLegend;
  pct: number;
}

export interface StrategyDnaStats {
  avgHoldingDays: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  preferredSectors: string[];
  riskTolerance: number;
}

export interface StrategyDnaResponse {
  primary: StrategyDnaMatch;
  secondary: StrategyDnaMatch;
  insight: string;
  stats: StrategyDnaStats;
  hasEnoughData: boolean;
}

export type ReverseScreenerTrend = "up" | "down" | "flat";

export interface ReverseScreenerCurrentSetup {
  rsi: number;
  volume: number;
  priceChange: number;
  trend: ReverseScreenerTrend;
}

export interface ReverseScreenerMatch {
  symbol: string;
  date: string;
  similarity: number;
  outcome5d: number;
  outcome10d: number;
}

export interface ReverseScreenerFindResponse {
  currentSetup: ReverseScreenerCurrentSetup;
  matches: ReverseScreenerMatch[];
  avgOutcome: number;
}

export type EarningsPredictionLabel = "BEAT" | "MISS" | "IN_LINE";

export interface EarningsPredictionResponse {
  symbol: string;
  prediction: EarningsPredictionLabel;
  confidence: number;
  reasoning: string;
  nextEarningsDate: string | null;
}

export interface TrackRecordGenerateResponse {
  publicHash: string;
  shareUrl: string;
}

export interface TrackRecordPublicResponse {
  winRate: number;
  totalTrades: number;
  avgReturn: number;
  bestTradePct: number;
  worstTradePct: number;
  generatedAt: string;
}

export type SkillTreeSkillId =
  | "BASICS"
  | "SUPPORT_RESISTANCE"
  | "RSI"
  | "MACD"
  | "FIBONACCI"
  | "VOLUME"
  | "RISK_MANAGEMENT"
  | "BEHAVIORAL"
  | "DIVERSIFICATION"
  | "STRATEGY";

export interface SkillTreeSkill {
  id: SkillTreeSkillId;
  name: string;
  description: string;
  unlockCondition: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface SkillTreeResponse {
  skills: SkillTreeSkill[];
  totalUnlocked: number;
  totalSkills: number;
}

export interface SkillTreeCheckResponse {
  newlyUnlocked: SkillTreeSkillId[];
}

export interface VolatilityHeatmapEntry {
  year: number;
  month: number;
  volatility: number;
  avgReturn: number;
}

export interface VolatilityHeatmapResponse {
  symbol: string;
  heatmap: VolatilityHeatmapEntry[];
  mostVolatileMonth: string;
  leastVolatileMonth: string;
}

export interface DailyDigestResponse {
  digest: string;
  date: string;
}

export type CrowdWisdomSignal = "CONTRARIAN_BUY" | "CONTRARIAN_SELL" | "NEUTRAL";

export interface CrowdWisdomResponse {
  symbol: string;
  retailBullish: number;
  insiderBuying: number;
  divergence: number;
  insight: string;
  signal: CrowdWisdomSignal;
}

export type InsiderAction = "BUY" | "SELL";

export type InsiderSentiment = "BUY" | "SELL" | "NEUTRAL";

export interface InsiderTransaction {
  name: string;
  role: string;
  action: InsiderAction;
  value: number;
  date: string;
}

export interface InsiderMirrorResponse {
  symbol: string;
  transactions: InsiderTransaction[];
  netSentiment: InsiderSentiment;
  insight: string;
}

export interface GlossaryExplainResponse {
  term: string;
  explanation: string;
  example: string;
  cached: boolean;
}

export interface CorrelationResultRow {
  symbol: string;
  correlation: number;
  warning: boolean;
}

export interface CorrelationHighRiskPair {
  a: string;
  b: string;
  correlation: number;
}

export interface CorrelationAnalyzeResponse {
  correlations: CorrelationResultRow[];
  highRiskPairs: CorrelationHighRiskPair[];
  insight: string;
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

export async function getNewsHalfLife(symbol: string): Promise<NewsHalfLifeResponse> {
  const { data } = await api.get<NewsHalfLifeResponse>(`/news/halflife/${encodeURIComponent(symbol)}`);
  return data;
}

export async function getBehavioralCooldown(userId: string): Promise<BehavioralCooldownResponse> {
  const { data } = await api.get<BehavioralCooldownResponse>(`/behavioral/cooldown/${encodeURIComponent(userId)}`);
  return data;
}

export async function trackEmotionalState(input: EmotionalTrackInput): Promise<EmotionalTrackResponse> {
  const { data } = await api.post<EmotionalTrackResponse>("/emotional/track", input);
  return data;
}

export async function getEmotionalStatus(userId: string): Promise<EmotionalStatusResponse> {
  const { data } = await api.get<EmotionalStatusResponse>(`/emotional/status/${encodeURIComponent(userId)}`);
  return data;
}

export async function runPreMortem(input: PreMortemInput): Promise<PreMortemResponse> {
  const { data } = await api.post<PreMortemResponse>("/premortem/analyze", input);
  return data;
}

export async function getReplaySnapshot(
  symbol: string,
  date: string,
): Promise<ReplaySnapshotResponse> {
  const { data } = await api.get<ReplaySnapshotResponse>("/replay/snapshot", {
    params: { symbol, date },
  });
  return data;
}

export async function evaluateReplayDecision(
  body: ReplayEvaluateBody,
): Promise<ReplayEvaluateResponse> {
  const { data } = await api.post<ReplayEvaluateResponse>("/replay/evaluate", body);
  return data;
}

export async function getStrategyDna(userId: string): Promise<StrategyDnaResponse> {
  const { data } = await api.get<StrategyDnaResponse>(`/strategydna/${encodeURIComponent(userId)}`);
  return data;
}

export async function findReverseScreenerSetups(body: {
  symbol: string;
  date?: string;
}): Promise<ReverseScreenerFindResponse> {
  const { data } = await api.post<ReverseScreenerFindResponse>("/reversescreener/find", body);
  return data;
}

export async function getEarningsPrediction(symbol: string): Promise<EarningsPredictionResponse> {
  const { data } = await api.get<EarningsPredictionResponse>(
    `/earnings/predict/${encodeURIComponent(symbol)}`,
  );
  return data;
}

export async function generateTrackRecord(userId: string): Promise<TrackRecordGenerateResponse> {
  const { data } = await api.post<TrackRecordGenerateResponse>(
    `/trackrecord/generate/${encodeURIComponent(userId)}`,
  );
  return data;
}

export async function getPublicTrackRecord(hash: string): Promise<TrackRecordPublicResponse> {
  const { data } = await api.get<TrackRecordPublicResponse>(
    `/trackrecord/public/${encodeURIComponent(hash)}`,
  );
  return data;
}

export async function getSkillTree(userId: string): Promise<SkillTreeResponse> {
  const { data } = await api.get<SkillTreeResponse>(`/skilltree/${encodeURIComponent(userId)}`);
  return data;
}

export async function checkSkillTree(userId: string): Promise<SkillTreeCheckResponse> {
  const { data } = await api.post<SkillTreeCheckResponse>(
    `/skilltree/${encodeURIComponent(userId)}/check`,
  );
  return data;
}

export async function getVolatilityHeatmap(symbol: string): Promise<VolatilityHeatmapResponse> {
  const { data } = await api.get<VolatilityHeatmapResponse>(
    `/volatility/heatmap/${encodeURIComponent(symbol)}`,
  );
  return data;
}

export async function previewDailyDigest(userId: string, lang: string): Promise<DailyDigestResponse> {
  const { data } = await api.get<DailyDigestResponse>(`/digest/preview/${encodeURIComponent(userId)}`, {
    params: { lang },
  });
  return data;
}

export async function sendDailyDigest(userId: string, lang: string): Promise<DailyDigestResponse> {
  const { data } = await api.post<DailyDigestResponse>(`/digest/send/${encodeURIComponent(userId)}`, undefined, {
    params: { lang },
  });
  return data;
}

export async function getCrowdWisdom(symbol: string): Promise<CrowdWisdomResponse> {
  const { data } = await api.get<CrowdWisdomResponse>(`/crowdwisdom/${encodeURIComponent(symbol)}`);
  return data;
}

export async function getInsiderMirror(symbol: string): Promise<InsiderMirrorResponse> {
  const { data } = await api.get<InsiderMirrorResponse>(`/insider/${encodeURIComponent(symbol)}`);
  return data;
}

export async function explainGlossaryTerm(term: string, lang: string): Promise<GlossaryExplainResponse> {
  const { data } = await api.get<GlossaryExplainResponse>("/glossary/explain", {
    params: { term, lang },
  });
  return data;
}

export async function analyzeCorrelation(body: {
  symbol: string;
  portfolio: string[];
}): Promise<CorrelationAnalyzeResponse> {
  const { data } = await api.post<CorrelationAnalyzeResponse>("/correlation/analyze", body);
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

export type WalkForwardStrategy = "RSI_OVERSOLD" | "BREAKOUT" | "VOLUME_SPIKE";

export interface WalkForwardBacktestResponse {
  symbol: string;
  strategy: WalkForwardStrategy;
  months: number;
  winRate: number;
  avgReturn: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  equity: Array<{ date: string; value: number }>;
  trades: Array<{ date: string; action: string; price: number; outcome: number }>;
}

export async function runWalkForwardBacktestApi(body: {
  symbol: string;
  strategy: WalkForwardStrategy;
  months: number;
}): Promise<WalkForwardBacktestResponse> {
  const { data } = await api.post<WalkForwardBacktestResponse>("/backtest/run", body);
  return data;
}
