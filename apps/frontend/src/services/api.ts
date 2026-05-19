import axios, { AxiosError } from "axios";
import type { DividendAlertsResponse, DividendIntelligence, SectorComparison } from "../types/dividend";

const AUTH_TOKEN_STORAGE_KEY = "auth_token";
const AUTH_USER_ID_STORAGE_KEY = "userId";
const LEGACY_DEMO_USER_ID = "demo-user";

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

function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function readUserId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(AUTH_USER_ID_STORAGE_KEY)?.trim();
  return id || null;
}

function replaceLegacyUserId(value: unknown, userId: string): unknown {
  if (typeof value === "string") {
    return value === LEGACY_DEMO_USER_ID ? userId : value.replaceAll(`/${LEGACY_DEMO_USER_ID}`, `/${userId}`);
  }
  if (Array.isArray(value)) {
    return value.map((x) => replaceLegacyUserId(x, userId));
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      next[k] = replaceLegacyUserId(v, userId);
    }
    return next;
  }
  return value;
}

export const api = axios.create({
  baseURL,
  headers: { Accept: "application/json" },
  timeout: 60_000,
});

const publicApi = axios.create({
  baseURL,
  headers: { Accept: "application/json" },
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = readAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const userId = readUserId();
  if (userId) {
    if (typeof config.url === "string") {
      config.url = replaceLegacyUserId(config.url, userId) as string;
    }
    if (config.params != null) {
      config.params = replaceLegacyUserId(config.params, userId);
    }
    if (config.data != null) {
      config.data = replaceLegacyUserId(config.data, userId);
    }
  }

  return config;
});

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  language: string | null;
  timezone: string | null;
  avatarUrl: string | null;
  tier: string;
  lastLoginAt: string | null;
}

export interface UserProfileUpdateInput {
  name?: string | null;
  language?: string;
  timezone?: string;
  avatar?: string | null;
}

export interface Company {
  symbol: string;
  name: string;
  exchange?: string | null;
  sector: string;
  industry: string;
  logoUrl: string | null;
  description: string | null;
  webUrl: string | null;
  createdAt: string;
}

export interface SearchResponse {
  symbol?: string;
  name?: string;
  exchange?: string | null;
  sector?: string | null;
  source?: "database" | "eodhd";
  results?: Array<{
    symbol: string;
    name: string;
    exchange?: string;
    currency?: string | null;
    type?: string | null;
    logoUrl?: string | null;
  }>;
  query?: string;
  count?: number;
  data?: Company[];
}

export interface CompanySearchSuggestion {
  symbol: string;
  name: string;
  exchange: string | null;
  sector: string;
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

export interface LiveQuoteResponse {
  quote: {
    ticker: string;
    price: string;
    open: string | null;
    updatedAt: string;
  };
}

export interface TopLiveQuotesResponse {
  limit: number;
  count: number;
  quotes: Array<{
    ticker: string;
    price: string;
    open: string | null;
    updatedAt: string;
  }>;
}

export interface LatestSymbolQuoteResponse {
  symbol: string;
  open: string;
  close: string;
  timestamp: string;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  addedAt: string;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
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

export type DecisionReceiptKind = "PROCEED_PREMORTEM" | "CLOSED_LOSS";

export type DecisionReceiptPayload = Record<string, unknown>;

export interface DecisionReceipt {
  id: string;
  userId: string;
  paperTradeId: string | null;
  kind: DecisionReceiptKind;
  symbol: string;
  payload: DecisionReceiptPayload;
  createdAt: string;
}

export interface DecisionReceiptsResponse {
  receipts: DecisionReceipt[];
}

export interface TraderProfile {
  id: string;
  userId: string;
  topBiases: string[];
  tradingStyle: string | null;
  goodConditions: string | null;
  badConditions: string | null;
  growthScore: number;
  updatedAt: string;
}

export interface PsycheProfileResponse {
  profile: TraderProfile | null;
  hasProfile: boolean;
}

export interface PsycheDecisionLog {
  id: string;
  userId: string;
  tradeId: string | null;
  symbol: string;
  action: string;
  mood: string | null;
  reasoning: string | null;
  planCompliance: boolean | null;
  outcome: number | null;
  createdAt: string;
}

export interface PsycheTradingRule {
  id: string;
  userId: string;
  rule: string;
  active: boolean;
  breaches: number;
  createdAt: string;
}

export type DailyCheckInRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface DailyCheckIn {
  id: string;
  userId: string;
  mood: number;
  plan: string | null;
  riskLevel: DailyCheckInRiskLevel | null;
  aiMessage: string | null;
  createdAt: string;
}

export interface PostTradeReflection {
  id: string;
  userId: string;
  tradeId: string;
  followedPlan: boolean;
  emotion: string | null;
  lesson: string | null;
  aiInsight: string | null;
  createdAt: string;
}

export interface WeeklyReviewAnswers {
  q1: number;
  q2: number;
  q3: number;
  q4: string;
  q5: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  answers: WeeklyReviewAnswers;
  aiLetter: string | null;
  growthScore: number | null;
  createdAt: string;
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

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const { data } = await api.get<{ profile: UserProfile }>(`/user/profile/${encodeURIComponent(userId)}`);
  return data.profile;
}

export async function updateUserProfile(
  userId: string,
  body: UserProfileUpdateInput,
): Promise<UserProfile> {
  const { data } = await api.put<{ profile: UserProfile }>(
    `/user/profile/${encodeURIComponent(userId)}`,
    body,
  );
  return data.profile;
}

export async function searchCompaniesAutocomplete(query: string, limit = 8): Promise<CompanySearchSuggestion[]> {
  const { data } = await api.get<SearchResponse>("/companies/search", {
    params: { q: query, limit },
  });
  if (Array.isArray(data)) {
    return data
      .filter((row): row is SearchResponse => typeof row?.symbol === "string" && typeof row?.name === "string")
      .map((row) => ({
        symbol: row.symbol as string,
        name: row.name as string,
        exchange: row.exchange ?? null,
        sector: row.sector ?? "Unknown",
      }));
  }
  if (Array.isArray(data.results)) {
    return data.results.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange ?? null,
      sector: "Unknown",
    }));
  }
  if (Array.isArray(data.data)) {
    return data.data.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange ?? null,
      sector: row.sector ?? "Unknown",
    }));
  }
  return [];
}

export async function searchCompanies(query: string, limit = 20): Promise<Company[]> {
  const rows = await searchCompaniesAutocomplete(query, limit);
  return rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange ?? null,
    sector: row.sector ?? "Unknown",
    industry: "Unknown",
    logoUrl: null,
    description: row.exchange ? `Exchange=${row.exchange}` : null,
    webUrl: null,
    createdAt: new Date().toISOString(),
  }));
}

export async function importCompanyFromSearch(symbol: string, exchange?: string | null): Promise<void> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return;
  const [baseSymbol, exchangeFromSymbol = ""] = normalizedSymbol.split(".");
  const resolvedExchange = (exchange ?? exchangeFromSymbol).trim().toUpperCase();
  if (!baseSymbol || !resolvedExchange) return;
  await api.get("/companies/search/import", {
    params: {
      symbol: baseSymbol,
      exchange: resolvedExchange,
    },
  });
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

export async function getLatestLiveQuote(ticker: string): Promise<LiveQuoteResponse> {
  const { data } = await publicApi.get<LiveQuoteResponse>("/quotes/latest", {
    params: { ticker: ticker.trim().toUpperCase() },
  });
  return data;
}

export async function getTopLiveQuotes(limit = 10): Promise<TopLiveQuotesResponse> {
  const { data } = await publicApi.get<TopLiveQuotesResponse>("/quotes/top", {
    params: { limit },
  });
  return data;
}

export async function getLatestQuoteBySymbol(symbol: string): Promise<LatestSymbolQuoteResponse> {
  const { data } = await publicApi.get<LatestSymbolQuoteResponse>(`/quotes/${encodeURIComponent(symbol)}`);
  return data;
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data } = await api.get<WatchlistResponse>(`/watchlist/${encodeURIComponent(userId)}`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function addToWatchlist(userId: string, symbol: string): Promise<WatchlistItem> {
  const { data } = await api.post<WatchlistItem>("/watchlist", {
    userId,
    symbol: symbol.trim().toUpperCase(),
  });
  return data;
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>(
    `/watchlist/${encodeURIComponent(userId)}/${encodeURIComponent(symbol.trim().toUpperCase())}`,
  );
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

export async function postDecisionReceipt(body: {
  userId: string;
  paperTradeId: string;
  kind: DecisionReceiptKind;
  symbol: string;
  payload: DecisionReceiptPayload;
}): Promise<DecisionReceipt> {
  const { data } = await api.post<DecisionReceipt>("/paper/decision-receipt", body);
  return data;
}

export async function getDecisionReceipts(userId: string, take?: number): Promise<DecisionReceiptsResponse> {
  const { data } = await api.get<DecisionReceiptsResponse>(`/paper/decision-receipts/${encodeURIComponent(userId)}`, {
    params: take != null ? { take } : undefined,
  });
  return data;
}

export async function getPsycheProfile(userId: string): Promise<PsycheProfileResponse> {
  const { data } = await api.get<PsycheProfileResponse>(`/psyche/profile/${encodeURIComponent(userId)}`);
  return data;
}

export async function refreshPsycheProfile(userId: string): Promise<{ profile: TraderProfile }> {
  const { data } = await api.post<{ profile: TraderProfile }>(`/psyche/profile/${encodeURIComponent(userId)}/refresh`);
  return data;
}

export async function getPsycheRules(userId: string): Promise<{ rules: PsycheTradingRule[] }> {
  const { data } = await api.get<{ rules: PsycheTradingRule[] }>(`/psyche/rules/${encodeURIComponent(userId)}`);
  return data;
}

export async function createPsycheRule(userId: string, rule: string): Promise<{ rule: PsycheTradingRule }> {
  const { data } = await api.post<{ rule: PsycheTradingRule }>(`/psyche/rules/${encodeURIComponent(userId)}`, {
    rule,
  });
  return data;
}

export async function deletePsycheRule(ruleId: string, userId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>(`/psyche/rules/${encodeURIComponent(ruleId)}`, {
    params: { userId },
  });
  return data;
}

export async function createPsycheDecisionLog(body: {
  userId: string;
  symbol: string;
  action: string;
  mood?: string | null;
  reasoning?: string | null;
  tradeId?: string | null;
  planCompliance?: boolean | null;
  outcome?: number | null;
}): Promise<{ log: PsycheDecisionLog }> {
  const { data } = await api.post<{ log: PsycheDecisionLog }>("/psyche/decision-log", body);
  return data;
}

export async function getPsycheDecisionLogs(userId: string, take?: number): Promise<{ logs: PsycheDecisionLog[] }> {
  const { data } = await api.get<{ logs: PsycheDecisionLog[] }>(`/psyche/decision-log/${encodeURIComponent(userId)}`, {
    params: take != null ? { take } : undefined,
  });
  return data;
}

export async function getDailyCheckInToday(
  userId: string,
): Promise<{ checkin: DailyCheckIn | null; hasCheckedIn: boolean }> {
  const { data } = await api.get<{ checkin: DailyCheckIn | null; hasCheckedIn: boolean }>(
    `/checkin/today/${encodeURIComponent(userId)}`,
  );
  return data;
}

export async function createDailyCheckIn(body: {
  userId: string;
  mood: number;
  plan?: string;
  riskLevel?: DailyCheckInRiskLevel;
}): Promise<{ checkin: DailyCheckIn; aiMessage: string }> {
  const { data } = await api.post<{ checkin: DailyCheckIn; aiMessage: string }>("/checkin", body);
  return data;
}

export async function getDailyCheckInHistory(
  userId: string,
  days = 30,
): Promise<{ checkins: DailyCheckIn[]; avgMood: number }> {
  const { data } = await api.get<{ checkins: DailyCheckIn[]; avgMood: number }>(
    `/checkin/history/${encodeURIComponent(userId)}`,
    { params: { days } },
  );
  return data;
}

export async function createPostTradeReflection(body: {
  userId: string;
  tradeId: string;
  followedPlan: boolean;
  emotion?: string | null;
  lesson?: string | null;
}): Promise<{ reflection: PostTradeReflection; aiInsight: string }> {
  const { data } = await api.post<{ reflection: PostTradeReflection; aiInsight: string }>("/reflection", body);
  return data;
}

export async function getPostTradeReflections(
  userId: string,
  limit = 10,
): Promise<{ reflections: PostTradeReflection[] }> {
  const { data } = await api.get<{ reflections: PostTradeReflection[] }>(
    `/reflection/${encodeURIComponent(userId)}`,
    { params: { limit } },
  );
  return data;
}

export async function getCurrentWeeklyReview(
  userId: string,
): Promise<{ review: WeeklyReview | null; hasReview: boolean }> {
  const { data } = await api.get<{ review: WeeklyReview | null; hasReview: boolean }>(
    `/weekly/current/${encodeURIComponent(userId)}`,
  );
  return data;
}

export async function createWeeklyReview(body: {
  userId: string;
  q1: number;
  q2: number;
  q3: number;
  q4: string;
  q5: string;
}): Promise<{ review: WeeklyReview; letter: string }> {
  const { data } = await api.post<{ review: WeeklyReview; letter: string }>("/weekly", body);
  return data;
}

export async function getWeeklyReviewHistory(
  userId: string,
  weeks = 8,
): Promise<{ reviews: WeeklyReview[] }> {
  const { data } = await api.get<{ reviews: WeeklyReview[] }>(`/weekly/history/${encodeURIComponent(userId)}`, {
    params: { weeks },
  });
  return data;
}

export type TradeReactionItem = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

export async function getTradeReactions(tradeId: string): Promise<TradeReactionItem[]> {
  const { data } = await api.get<{ reactions: TradeReactionItem[] }>(
    `/reactions/trade/${encodeURIComponent(tradeId)}`,
  );
  return Array.isArray(data.reactions) ? data.reactions : [];
}

export async function getSignalReactions(signalId: string): Promise<TradeReactionItem[]> {
  const { data } = await api.get<{ reactions: TradeReactionItem[] }>(
    `/reactions/signal/${encodeURIComponent(signalId)}`,
  );
  return Array.isArray(data.reactions) ? data.reactions : [];
}

export async function postTradeReaction(body: {
  userId: string;
  tradeId: string;
  content: string;
}): Promise<void> {
  await api.post("/reactions/trade", body);
}

export async function postSignalReaction(body: {
  userId: string;
  signalId: string;
  content: string;
}): Promise<void> {
  await api.post("/reactions/signal", body);
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
  const sym = encodeURIComponent(symbol.trim().toUpperCase());
  const params = { lang };
  const paths = [
    `/companies/${sym}/brief`,
    `/brief/${sym}`,
    `/analysis/${sym}`,
  ] as const;

  let lastError: unknown;
  for (const path of paths) {
    try {
      // Public market brief — no JWT (avoids spurious 401 from stale tokens on shared routes).
      const { data } = await publicApi.get<AnalysisResponse>(path, { params });
      return data;
    } catch (error) {
      lastError = error;
      if (error instanceof AxiosError && error.response?.status === 404) {
        continue;
      }
      // Retry next path on auth/upstream failures (e.g. misrouted /brief).
      if (
        error instanceof AxiosError &&
        error.response?.status != null &&
        [401, 403, 502, 503].includes(error.response.status)
      ) {
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("Brief unavailable");
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

export interface DividendCompoundChartPoint {
  year: number;
  value: number;
}

export interface DividendCompoundSeries {
  final: number;
  chart: DividendCompoundChartPoint[];
}

export interface DividendCompoundResponse {
  withReinvesting: DividendCompoundSeries;
  withoutReinvesting: DividendCompoundSeries;
  difference: number;
}

export async function calculateDividendCompound(body: {
  initialAmount: number;
  monthlyContribution: number;
  dividendYield: number;
  years: number;
}): Promise<DividendCompoundResponse> {
  const { data } = await api.post<DividendCompoundResponse>(
    "/dividend/compound/calculate",
    body,
  );
  return data;
}

export type AlpacaOrderSide = "buy" | "sell";
export type AlpacaOrderType = "market" | "limit";

export interface AlpacaAccountResponse {
  account: Record<string, unknown>;
  mode: "paper" | "live";
}

export interface AlpacaPositionsResponse {
  positions: Record<string, unknown>[];
}

export interface AlpacaOrdersResponse {
  orders: Record<string, unknown>[];
}

export interface AlpacaPortfolioHistoryResponse {
  equity: number[];
  timestamps: number[];
}

export interface AffiliateBrokerItem {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  supportedMarkets: string[];
  legalDisclaimer: Record<string, unknown> | null;
  riskWarning: Record<string, unknown> | null;
  priority: number;
}

export interface AffiliateBrokersResponse {
  country: string | null;
  market: string | null;
  defaultBroker: AffiliateBrokerItem | null;
  brokers: AffiliateBrokerItem[];
}

export interface AdminAffiliateBrokerPayload {
  slug: string;
  displayName: string;
  logoUrl?: string | null;
  partnerId: string;
  affiliateProgramUrl?: string | null;
  baseUrl: string;
  tickerUrlTemplate?: string | null;
  clickIdParam?: string;
  attributionMethod: string;
  supportedCountries: string[];
  supportedMarkets: string[];
  primaryLanguage?: string | null;
  commissionModel: string;
  commissionCpaAmount?: number | null;
  commissionRevsharePct?: number | null;
  commissionCurrency: string;
  conversionTracking?: string | null;
  apiEndpoint?: string | null;
  webhookSecret?: string | null;
  isActive: boolean;
  priority: number;
  legalDisclaimer?: Record<string, unknown> | null;
  riskWarning?: Record<string, unknown> | null;
}

export interface AdminAffiliateBrokerResponse {
  brokers?: AdminAffiliateBrokerPayload[];
  broker?: AdminAffiliateBrokerPayload;
}

export type AdminTier = "FREE" | "PRO" | "PRO_PLUS";

export interface AdminStatsResponse {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  proPlusUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalSignals: number;
  totalTrades: number;
  affiliateClicks: number;
  affiliateConversions: number;
}

export interface AdminUserItem {
  id: string;
  email: string;
  tier: AdminTier | string;
  createdAt: string;
  lastLogin: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  page: number;
  limit: number;
  total: number;
}

export interface AdminAffiliateStatsResponse {
  totalClicks: number;
  clicksByBroker: Record<string, number>;
  clicksByLang: Record<string, number>;
  clicksByPage: Record<string, number>;
  clicksLast7Days: Array<{ date: string; count: number }>;
  clicksLast30Days: number;
}

export interface AdminAffiliateClickItem {
  id: string;
  broker: string;
  lang: string;
  page: string;
  createdAt: string;
}

export interface AdminAffiliateClicksResponse {
  page: number;
  limit: number;
  total: number;
  clicks: AdminAffiliateClickItem[];
}

export interface AdminErrorItem {
  id: number;
  jobId: string;
  ticker: string;
  attempt: number;
  status: string;
  createdAt: string;
}

export interface TaxSystemItem {
  code: string;
  name: string;
  currency: string;
  cgt: { rate: number | null; name: string; note?: string };
  form: string;
  note?: string;
}

export interface TaxCalculateResponse {
  grossGains: number;
  losses: number;
  netIncome: number;
  taxRate: number;
  taxDue: number;
  taxName: string;
  form: string;
  note?: string;
  currency: string;
  country: string;
  countryName: string;
  trades: Array<{ ticker: string; openDate: string; closeDate: string; pnl: number; pnlPct: number }>;
}

export async function getAlpacaAccount(userId: string): Promise<AlpacaAccountResponse> {
  const { data } = await api.get<AlpacaAccountResponse>("/alpaca/account", { params: { userId } });
  return data;
}

export async function getAlpacaPositions(userId: string): Promise<AlpacaPositionsResponse> {
  const { data } = await api.get<AlpacaPositionsResponse>("/alpaca/positions", { params: { userId } });
  return data;
}

export async function getAlpacaOrders(userId: string, status = "all"): Promise<AlpacaOrdersResponse> {
  const { data } = await api.get<AlpacaOrdersResponse>("/alpaca/orders", { params: { userId, status } });
  return data;
}

export async function placeAlpacaOrder(body: {
  userId: string;
  symbol: string;
  qty: number;
  side: AlpacaOrderSide;
  type: AlpacaOrderType;
  limitPrice?: number;
}): Promise<{ order: Record<string, unknown> }> {
  const { data } = await api.post<{ order: Record<string, unknown> }>("/alpaca/orders", body);
  return data;
}

export async function cancelAlpacaOrder(userId: string, orderId: string): Promise<{ cancelled: boolean }> {
  const { data } = await api.delete<{ cancelled: boolean }>(`/alpaca/orders/${encodeURIComponent(orderId)}`, {
    params: { userId },
  });
  return data;
}

export async function getAlpacaPortfolioHistory(userId: string): Promise<AlpacaPortfolioHistoryResponse> {
  const { data } = await api.get<AlpacaPortfolioHistoryResponse>("/alpaca/portfolio/history", {
    params: { userId },
  });
  return data;
}

export async function getAffiliateBrokers(params?: {
  country?: string;
  market?: string;
}): Promise<AffiliateBrokersResponse> {
  const { data } = await api.get<AffiliateBrokersResponse>("/affiliate/brokers", {
    params,
  });
  return data;
}

export async function getAdminAffiliateBrokers(): Promise<AdminAffiliateBrokerPayload[]> {
  const { data } = await api.get<AdminAffiliateBrokerResponse>("/admin/affiliate/brokers");
  return data.brokers ?? [];
}

export async function createAdminAffiliateBroker(
  body: AdminAffiliateBrokerPayload,
): Promise<AdminAffiliateBrokerPayload> {
  const { data } = await api.post<AdminAffiliateBrokerResponse>("/admin/affiliate/brokers", body);
  if (!data.broker) throw new Error("Broker not returned");
  return data.broker;
}

export async function updateAdminAffiliateBroker(
  slug: string,
  body: Partial<AdminAffiliateBrokerPayload>,
): Promise<AdminAffiliateBrokerPayload> {
  const { data } = await api.patch<AdminAffiliateBrokerResponse>(
    `/admin/affiliate/brokers/${encodeURIComponent(slug)}`,
    body,
  );
  if (!data.broker) throw new Error("Broker not returned");
  return data.broker;
}

export async function deleteAdminAffiliateBroker(slug: string): Promise<void> {
  await api.delete(`/admin/affiliate/brokers/${encodeURIComponent(slug)}`);
}

export async function importAdminAffiliateCsv(body: {
  brokerSlug: string;
  csvContent: string;
}): Promise<{
  imported: number;
  matched: number;
  unmatched: number;
  errors: Array<{ row: number; error: string }>;
}> {
  const { data } = await api.post("/admin/affiliate/import-csv", body);
  return data as {
    imported: number;
    matched: number;
    unmatched: number;
    errors: Array<{ row: number; error: string }>;
  };
}

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const { data } = await api.get<AdminStatsResponse>("/admin/stats");
  return data;
}

export async function getAdminUsers(page = 1, limit = 20): Promise<AdminUsersResponse> {
  const { data } = await api.get<AdminUsersResponse>("/admin/users", {
    params: { page, limit },
  });
  return data;
}

export async function updateAdminUserTier(userId: string, tier: AdminTier): Promise<{ user: AdminUserItem }> {
  const { data } = await api.post<{ user: AdminUserItem }>(
    `/admin/user/${encodeURIComponent(userId)}/tier`,
    { tier },
  );
  return data;
}

export async function getAdminErrors(): Promise<{ errors: AdminErrorItem[] }> {
  const { data } = await api.get<{ errors: AdminErrorItem[] }>("/admin/errors");
  return data;
}

export async function getAdminAffiliateStats(): Promise<AdminAffiliateStatsResponse> {
  const { data } = await api.get<AdminAffiliateStatsResponse>("/admin/affiliate/stats");
  return data;
}

export async function getAdminAffiliateClicks(
  page = 1,
  limit = 20,
): Promise<AdminAffiliateClicksResponse> {
  const { data } = await api.get<AdminAffiliateClicksResponse>("/admin/affiliate/clicks", {
    params: { page, limit },
  });
  return data;
}

export async function getAlpacaSettings(userId: string): Promise<{
  alpacaApiKey: string | null;
  alpacaApiSecret: string | null;
  alpacaMode: "paper" | "live" | null;
  taxCountry: string | null;
}> {
  const { data } = await api.get<{
    alpacaApiKey: string | null;
    alpacaApiSecret: string | null;
    alpacaMode: "paper" | "live" | null;
    taxCountry: string | null;
  }>(`/alpaca/settings/${encodeURIComponent(userId)}`);
  return data;
}

export async function saveAlpacaSettings(body: {
  userId: string;
  alpacaApiKey?: string;
  alpacaApiSecret?: string;
  alpacaMode?: "paper" | "live";
  taxCountry?: string;
}): Promise<{ saved: boolean }> {
  const { data } = await api.post<{ saved: boolean }>("/alpaca/settings", body);
  return data;
}

export interface NotificationPreferences {
  discordWebhook: string | null;
  telegramChatId: string | null;
  notifySignals: boolean;
  notifyDividends: boolean;
  minSignalScore: number;
}

export interface NotificationDeliveryResponse {
  discordSent: boolean;
  telegramSent: boolean;
}

export type NotificationType = "SIGNAL" | "DIVIDEND" | "SYSTEM" | "COACH" | string;

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export async function getNotificationPreferencesApi(userId: string): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>(`/notifications/preferences/${encodeURIComponent(userId)}`);
  return data;
}

export async function saveNotificationPreferencesApi(
  userId: string,
  body: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await api.put<NotificationPreferences>(
    `/notifications/preferences/${encodeURIComponent(userId)}`,
    body,
  );
  return data;
}

export async function testNotificationPreferencesApi(userId: string): Promise<NotificationDeliveryResponse> {
  const { data } = await api.post<NotificationDeliveryResponse>(
    `/notifications/preferences/${encodeURIComponent(userId)}/test`,
  );
  return data;
}

export async function getNotificationsApi(userId: string, limit = 20): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>(`/notifications/${encodeURIComponent(userId)}`, {
    params: { limit },
  });
  return data;
}

export async function markAllNotificationsReadApi(userId: string): Promise<{ updatedCount: number }> {
  const { data } = await api.put<{ updatedCount: number }>(
    `/notifications/${encodeURIComponent(userId)}/read-all`,
  );
  return data;
}

export async function markNotificationReadApi(notificationId: string): Promise<NotificationItem> {
  const { data } = await api.put<NotificationItem>(`/notifications/${encodeURIComponent(notificationId)}/read`);
  return data;
}

export async function getTaxSystems(): Promise<TaxSystemItem[]> {
  const { data } = await api.get<{ systems: TaxSystemItem[] }>("/tax/systems");
  return Array.isArray(data.systems) ? data.systems : [];
}

export async function calculateTax(body: {
  userId: string;
  country: string;
  customRate?: number;
  trades?: Array<{ ticker: string; openDate: string; closeDate: string; pnl: number; pnlPct: number }>;
}): Promise<TaxCalculateResponse> {
  const { data } = await api.post<TaxCalculateResponse>("/tax/calculate", body);
  return data;
}

export type PremiumVerdictResponse = {
  ticker: string;
  score: number;
  label: string;
  components: Record<string, unknown>;
  prices: {
    current: number;
    entryLow: number;
    entryHigh: number;
    target12m: number;
    stopLoss: number;
    riskReward: number;
  };
  horizonMonths: number;
  computedAt: string;
};

export type PremiumPersonalFitResponse = {
  ticker: string;
  marketScore: number;
  personalScore: number;
  delta: number;
  matches: Array<{ dimension: string; value: string; score: number; max: number }>;
  mismatches: Array<{
    dimension: string;
    severity: string;
    explanation: string;
    threshold?: string;
    data?: Record<string, unknown>;
  }>;
  suggestedActions: Array<Record<string, unknown>>;
};

export type PremiumStoryResponse = {
  ticker: string;
  acts: Array<{
    act: number;
    title: string;
    narrative?: string;
    key_numbers?: Array<{ label: string; value: string }>;
    scenarios?: Array<{
      name: "BULL" | "BASE" | "BEAR";
      probability: number;
      narrative: string;
      target_price: number;
      target_pct: number;
    }>;
  }>;
  synthesis?: string;
  generated_at: string;
  language: string;
};

export type PremiumTwinsResponse = {
  ticker: string;
  current_setup: Record<string, unknown>;
  twins: Array<{
    ticker: string;
    date_of_match: string;
    match_score: number;
    common_attributes?: Array<{ dimension: string; current: string | number | boolean; twin: string | number | boolean }>;
    outcome_5y: {
      total_return_pct: number;
      max_drawdown_pct: number;
      volatility_annualized: number;
      notable_events?: string[];
    };
    lesson: string;
  }>;
  statistics: {
    bullish_outcomes: number;
    flat_outcomes: number;
    bearish_outcomes: number;
    avg_5y_return: number;
  };
  ai_synthesis: string;
};

export type PremiumCatchResponse = {
  ticker: string;
  bull_case: { title: string; narrative: string; supporting_facts?: Array<{ fact: string; source?: string }> };
  bear_case: { title: string; narrative: string; supporting_facts?: Array<{ fact: string; source?: string }> };
  dirty_truth: null | {
    title: string;
    one_liner: string;
    details: string;
    severity: "high" | "medium" | "low";
    evidence_link: string;
    category: string;
  };
  pre_mortem_context: { auto_filled_prompts: string[] };
  final_actions: Array<Record<string, unknown>>;
};

function premiumTickerCandidates(ticker: string): string[] {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return [];
  const base = normalized.split(".")[0]?.trim() ?? normalized;
  const out = [normalized];
  if (!out.includes(base)) out.push(base);
  const us = `${base}.US`;
  if (!out.includes(us)) out.push(us);
  return out;
}

async function getPremiumWithTickerFallback<T>(
  ticker: string,
  requestForTicker: (candidate: string) => Promise<T>,
): Promise<T> {
  const candidates = premiumTickerCandidates(ticker);
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await requestForTicker(candidate);
    } catch (error) {
      const status = error instanceof AxiosError ? error.response?.status : undefined;
      if (status !== 404) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error("Premium endpoint not found");
}

export async function getPremiumVerdict(ticker: string): Promise<PremiumVerdictResponse> {
  return getPremiumWithTickerFallback(ticker, async (candidate) => {
    const { data } = await api.get<PremiumVerdictResponse>(`/premium/${encodeURIComponent(candidate)}/verdict`);
    return data;
  });
}

export async function getPremiumPersonalFit(
  ticker: string,
  userId: string,
): Promise<PremiumPersonalFitResponse> {
  return getPremiumWithTickerFallback(ticker, async (candidate) => {
    const { data } = await api.get<PremiumPersonalFitResponse>(
      `/premium/${encodeURIComponent(candidate)}/personal-fit`,
      { params: { userId } },
    );
    return data;
  });
}

export async function getPremiumStory(
  ticker: string,
  language = "en",
  experienceLevel: "beginner" | "intermediate" | "advanced" = "intermediate",
): Promise<PremiumStoryResponse> {
  return getPremiumWithTickerFallback(ticker, async (candidate) => {
    const { data } = await api.get<PremiumStoryResponse>(`/premium/${encodeURIComponent(candidate)}/story`, {
      params: { language, experienceLevel },
    });
    return data;
  });
}

export async function getPremiumTwins(ticker: string): Promise<PremiumTwinsResponse> {
  return getPremiumWithTickerFallback(ticker, async (candidate) => {
    const { data } = await api.get<PremiumTwinsResponse>(`/premium/${encodeURIComponent(candidate)}/twins`);
    return data;
  });
}

export async function getPremiumCatch(ticker: string): Promise<PremiumCatchResponse> {
  return getPremiumWithTickerFallback(ticker, async (candidate) => {
    const { data } = await api.get<PremiumCatchResponse>(`/premium/${encodeURIComponent(candidate)}/catch`);
    return data;
  });
}

export type StripeCheckoutPlan = "pro" | "pro_plus";
export type StripeCheckoutBilling = "monthly" | "yearly";
export type WaitlistSource = "landing" | "pricing" | "signal";

export interface WaitlistSubmitResponse {
  ok: boolean;
  alreadyJoined: boolean;
  count: number;
}

export interface WaitlistCountResponse {
  count: number;
}

export interface ContactMessageBody {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactMessageResponse {
  success: boolean;
}

export async function createStripeCheckoutSession(body: {
  userId: string;
  plan: StripeCheckoutPlan;
  billing: StripeCheckoutBilling;
}): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>("/stripe/create-checkout-session", body);
  return data;
}

export async function joinWaitlist(body: {
  email: string;
  name?: string;
  source?: WaitlistSource;
}): Promise<WaitlistSubmitResponse> {
  const { data } = await publicApi.post<WaitlistSubmitResponse>("/waitlist", body);
  return data;
}

export async function getWaitlistCount(): Promise<WaitlistCountResponse> {
  const { data } = await publicApi.get<WaitlistCountResponse>("/waitlist");
  return data;
}

export async function sendContactMessage(body: ContactMessageBody): Promise<ContactMessageResponse> {
  const { data } = await publicApi.post<ContactMessageResponse>("/contact", body);
  return data;
}

export async function verifyEmailToken(token: string): Promise<{ verified: boolean }> {
  const { data } = await publicApi.get<{ verified: boolean }>("/auth/verify", {
    params: { token },
    headers: { Accept: "application/json" },
  });
  return data;
}

export async function forgotPassword(email: string): Promise<{ ok: boolean }> {
  const { data } = await publicApi.post<{ ok: boolean }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  const { data } = await publicApi.post<{ ok: boolean }>("/auth/reset-password", {
    token,
    newPassword,
  });
  return data;
}
