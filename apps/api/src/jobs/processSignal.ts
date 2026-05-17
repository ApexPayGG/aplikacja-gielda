import { Queue, Worker } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";
import { prisma } from "../db/index";
import { getMarketRegime, type MarketRegime } from "../marketRegime";
import { getDividendHealth, type DividendData } from "../modules/dividend/dividendModule";
import { generateNarrative, type NarrativeContext } from "../modules/narrativeEngine/narrativeEngine";
import { getSignalDnaSummary } from "../modules/signalDna/signalDna";
import { enqueueDiscordSignalAlert } from "../queues/discordSignalAlerts";
import { getCacheRedis } from "../redis";
import { recordAlphaJournalEvent } from "../services/alphaJournalService";
import { ALERT_QUEUE_NAME } from "./scanSignals";

export const PROCESS_SIGNAL_QUEUE_NAME = "process-signal";
export const PROCESS_SIGNAL_DLQ_NAME = "process-signal-dlq";
export const BATCH_LOW_SIGNALS_QUEUE_NAME = "batch-low-signals";
const PROCESS_SIGNAL_JOB_NAME = "process:signal";
const BATCH_LOW_SIGNALS_JOB_NAME = "batchLowSignals";
const ALERT_SENT_KEY_PREFIX = "alert:sent:";
const ALERT_SENT_TTL_SEC = 300;
const LOW_SIGNAL_BUFFER_KEY = "alerts:low:buffer";
const LOW_SIGNAL_WINDOW_MS = 5 * 60 * 1000;

export interface ProcessSignalJobInput {
  signalId: string;
}

interface BriefInput {
  ticker: string;
  pattern_type: string;
  confidence: number;
  rsi: number;
  macd: number;
  volume_ratio: number;
  support_level: number;
  price_position: number;
  historical_count: number;
  win_rate: number;
  avg_return_10d: number;
  max_drawdown: number;
  recent_news: string[];
  market_sentiment: string;
  sector_trend: string;
  vix: number;
  regime: string;
  regime_description: string;
}

interface ScoreInput {
  technical: number;
  history: number;
  sentiment: number;
  fundamentals: number;
  macro: number;
}

interface SignalAlertPayload {
  ticker: string;
  signal: string;
  score: number;
  brief: string;
  confidence?: number;
  timeframe?: string;
  setup?: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  logicalChannel?: string;
  marketRegime?: string;
  regimeConfidence?: number;
  playbookAction?: string;
  signalDna?: string;
  narrativeHeadline?: string;
  narrativeBody?: string;
  narrativeRisk?: string;
  narrativeConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

interface NewsItem {
  title: string;
  timestamp: Date;
  sentiment?: string | null;
}

interface MacroContext {
  marketSentiment: string;
  sectorTrend: string;
  vix: number;
}

interface SentimentResult {
  score: number;
  label: string;
}

interface LowSignalStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSec: number) => Promise<unknown>;
  rpush: (key: string, value: string) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  del: (key: string) => Promise<number>;
}

export interface ProcessSignalResult {
  signalId: string;
  alertsQueued: number;
  score: number;
}

export interface ProcessSignalDeps {
  db: typeof prisma;
  alertQueue: Pick<Queue, "add">;
  dlqQueue: Pick<Queue, "add">;
  idempotencyStore: Pick<ReturnType<typeof getCacheRedis>, "set" | "get" | "del">;
  fetchRecentNews: (ticker: string) => Promise<NewsItem[]>;
  classifySentiment: (input: { ticker: string; news: NewsItem[] }) => Promise<SentimentResult>;
  fetchMacroContext: (ticker: string) => Promise<MacroContext>;
  generateSignalBrief: (input: BriefInput) => Promise<{ pl: string; en: string }>;
  scoreSignal: (input: ScoreInput) => Promise<{ score: number; reasoning: string }>;
  fetchMarketRegime: (symbol: string) => Promise<MarketRegime>;
  logAlphaJournal: (entry: {
    ts: string;
    feature: string;
    symbol: string;
    impactScore: number;
    details: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  sendSignalAlert: (input: SignalAlertPayload) => Promise<void>;
  lowSignalQueue: Pick<Queue, "add">;
  lowSignalStore: LowSignalStore;
  getUsersWithMatchingCriteria: (input: {
    ticker: string;
    patternType: string;
    confidence: number;
    score: number;
  }) => Promise<Array<Record<string, unknown>>>;
}

export const processSignalLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "process_signal_job" },
});

function clampScore(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}

function computeTechnicalScore(technicalData: Record<string, unknown>, confidence: number): number {
  const rsi = Number(technicalData.rsi ?? 50);
  const macd = Number(technicalData.macd ?? 0);
  const volumeRatio = Number(technicalData.volume_ratio ?? 1);
  let score = confidence;
  if (rsi >= 40 && rsi <= 70) score += 8;
  if (macd > 0) score += 6;
  if (volumeRatio > 1.2) score += 6;
  return clampScore(score);
}

function computeHistoryScore(winRate: number | null, avgReturn10d: number | null, maxDrawdown: number | null): number {
  const win = Number(winRate ?? 50);
  const avgRet = Number(avgReturn10d ?? 0);
  const dd = Number(maxDrawdown ?? 10);
  return clampScore(win * 0.7 + (avgRet + 10) * 1.2 - dd * 0.6);
}

function computeMacroScore(m: MacroContext): number {
  const sentiment = m.marketSentiment.toLowerCase();
  const sector = m.sectorTrend.toLowerCase();
  let score = 50;
  if (sentiment.includes("bull")) score += 20;
  if (sentiment.includes("bear")) score -= 20;
  if (sector.includes("up")) score += 15;
  if (sector.includes("down")) score -= 15;
  score += Math.max(-15, Math.min(15, (20 - m.vix) * 1.2));
  return clampScore(score);
}

async function withRetry<T>(op: string, fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      processSignalLogger.warn({
        msg: "retryable_step_failed",
        op,
        attempt,
        err: error instanceof Error ? error.message : String(error),
      });
      if (attempt >= retries) break;
      const backoffMs = 250 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
}

async function defaultFetchRecentNews(ticker: string): Promise<NewsItem[]> {
  const from = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await prisma.news.findMany({
    where: { symbol: ticker.toUpperCase(), timestamp: { gte: from } },
    orderBy: { timestamp: "desc" },
    take: 20,
    select: { title: true, timestamp: true, sentiment: true },
  });
  return rows;
}

async function defaultClassifySentiment(input: { ticker: string; news: NewsItem[] }): Promise<SentimentResult> {
  const text = input.news.map((n) => `${n.title} ${n.sentiment ?? ""}`).join(" ").toLowerCase();
  if (!text) return { score: 50, label: "neutral" };
  const positive = ["beat", "growth", "strong", "upgrade", "buyback"];
  const negative = ["downgrade", "lawsuit", "miss", "weak", "cut"];
  let score = 50;
  for (const w of positive) if (text.includes(w)) score += 6;
  for (const w of negative) if (text.includes(w)) score -= 6;
  score = clampScore(score);
  return { score, label: score >= 60 ? "positive" : score <= 40 ? "negative" : "neutral" };
}

async function defaultFetchMacroContext(_ticker: string): Promise<MacroContext> {
  return {
    marketSentiment: process.env.MARKET_SENTIMENT ?? "neutral",
    sectorTrend: process.env.SECTOR_TREND ?? "sideways",
    vix: Number(process.env.VIX_LEVEL ?? 18),
  };
}

async function defaultGenerateSignalBrief(input: BriefInput): Promise<{ pl: string; en: string }> {
  const fallbackEn = `Signal ${input.pattern_type} on ${input.ticker} carries ${input.confidence}% confidence with ${input.market_sentiment} sentiment. Momentum and participation look constructive, yet risk remains elevated; use disciplined sizing, respect stop levels, and monitor volatility around key support and resistance.`;
  const fallbackPl = `Sygnał ${input.pattern_type} na ${input.ticker} ma ${input.confidence}% pewności i sentyment ${input.market_sentiment}. Technika wygląda konstruktywnie, ale trzymaj dyscyplinę wielkości pozycji i monitoruj zmienność przy wsparciu przed wejściem.`;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { pl: fallbackPl, en: fallbackEn };

  try {
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const client = new Anthropic({ apiKey });
    const prompt = [
      `Write a compact trading brief in ENGLISH for ${input.ticker}.`,
      "Length must be 30 to 50 words.",
      "Tone: professional, concise, risk-aware.",
      `Pattern: ${input.pattern_type}, confidence: ${input.confidence}, RSI: ${input.rsi}, MACD: ${input.macd}, volume ratio: ${input.volume_ratio}, win rate: ${input.win_rate}, avg return 10d: ${input.avg_return_10d}, max drawdown: ${input.max_drawdown}, sentiment: ${input.market_sentiment}, sector: ${input.sector_trend}, VIX: ${input.vix}.`,
      `Aktualny reżim rynkowy: ${input.regime} — ${input.regime_description}. Uwzględnij to w analizie.`,
      "Return only plain text with no markdown.",
    ].join(" ");

    const msg = await client.messages.create({
      model,
      max_tokens: 160,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim() : "";
    const normalized = text.replace(/\s+/g, " ");
    const wordCount = normalized ? normalized.split(/\s+/).length : 0;
    const en = wordCount >= 30 && wordCount <= 50 ? normalized : fallbackEn;
    return { pl: fallbackPl, en };
  } catch {
    return { pl: fallbackPl, en: fallbackEn };
  }
}

async function defaultScoreSignal(input: ScoreInput): Promise<{ score: number; reasoning: string }> {
  const score = clampScore(
    input.technical * 0.3 +
      input.history * 0.3 +
      input.sentiment * 0.2 +
      input.fundamentals * 0.15 +
      input.macro * 0.05,
  );
  return {
    score,
    reasoning: `Score ${score} bo: technical ${input.technical}, history ${input.history}, sentiment ${input.sentiment}, fundamentals ${input.fundamentals}, macro ${input.macro}`,
  };
}

function classifyPatternWeightKey(patternType: string): keyof MarketRegime["weights"] {
  const p = patternType.toLowerCase();
  if (p.includes("breakout")) return "breakout";
  if (p.includes("reversion") || p.includes("mean")) return "mean_reversion";
  return "momentum";
}

async function localFallbackMarketRegime(): Promise<MarketRegime> {
  return {
    regime: "RANGING",
    confidence: 25,
    description: "Local fallback regime for isolated job execution without Redis/market data context.",
    weights: { momentum: 1, mean_reversion: 1, breakout: 1 },
  };
}

function buildPlaybookAction(regime: MarketRegime, setupType: string): string {
  const setup = setupType.toLowerCase();
  if (regime.regime === "RISK_OFF") {
    return "Reduce risk, wait for stronger confirmation, and prefer defensive setups.";
  }
  if (regime.regime === "RANGING") {
    return "Favor mean-reversion entries near range edges; avoid chasing breakouts.";
  }
  if (regime.regime === "TRENDING" && setup.includes("breakout")) {
    return "Add on pullbacks after breakout confirmation; trail stop below structure.";
  }
  if (setup.includes("momentum") || setup.includes("volume")) {
    return "Scale in with momentum continuation only while volume stays supportive.";
  }
  return "Watch for confirmation before entry and keep position sizing disciplined.";
}

async function defaultSendSignalAlert(input: SignalAlertPayload): Promise<void> {
  await enqueueDiscordSignalAlert({
    ticker: input.ticker,
    signal: input.signal,
    score: input.score,
    brief: input.brief,
    confidence: input.confidence,
    timeframe: input.timeframe,
    setup: input.setup,
    entry: input.entry,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    logicalChannel: input.logicalChannel,
    marketRegime: input.marketRegime,
    regimeConfidence: input.regimeConfidence,
    signalDna: input.signalDna,
    narrativeHeadline: input.narrativeHeadline,
    narrativeBody: input.narrativeBody,
    narrativeRisk: input.narrativeRisk,
    narrativeConfidence: input.narrativeConfidence,
  });
}

async function maybeGetDividendData(ticker: string): Promise<DividendData | undefined> {
  try {
    return await getDividendHealth(ticker);
  } catch {
    return undefined;
  }
}

async function sendRadarSummaryWebhook(items: Array<{ ticker: string; score: number }>): Promise<void> {
  if (items.length === 0) return;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;
  const top = items.slice(0, 25);
  const lines = top.map((item) => `• ${item.ticker.toUpperCase()} — ${Math.round(item.score)}/100`).join("\n");
  const hidden = items.length > 25 ? `\n...and ${items.length - 25} more` : "";
  const tickers = Array.from(new Set(items.map((item) => item.ticker.toUpperCase())));
  const companies = await prisma.company.findMany({
    where: { symbol: { in: tickers } },
    select: { symbol: true, sector: true },
  });
  const sectorByTicker = new Map(companies.map((c) => [c.symbol.toUpperCase(), (c.sector ?? "Other").trim() || "Other"]));
  const sectorCounts = new Map<string, number>();
  for (const ticker of tickers) {
    const sector = sectorByTicker.get(ticker) ?? "Other";
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const sortedSectors = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sectorCluster =
    sortedSectors.length > 0 ? sortedSectors.slice(0, 3).map(([s, n]) => `${s} x${n}`).join(", ") : "n/a";
  const topSectorShare = sortedSectors.length > 0 ? (sortedSectors[0]?.[1] ?? 0) / tickers.length : 0;
  const concentration = topSectorShare >= 0.6 ? "HIGH" : topSectorShare >= 0.4 ? "MEDIUM" : "LOW";
  const payload = {
    embeds: [
      {
        title: "📋 Radar Summary",
        description: `${lines}${hidden}` || "No low-score signals in this window.",
        color: 0x3b82f6,
        fields: [
          { name: "Signals", value: String(items.length), inline: true },
          { name: "Sector Cluster", value: sectorCluster, inline: false },
          { name: "Concentration", value: `${concentration} (${Math.round(topSectorShare * 100)}%)`, inline: true },
        ],
        footer: { text: "Stock-AI Pro Signal Alerts" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Radar summary webhook failed (${res.status})`);
}

async function routeDiscordAlert(
  deps: Pick<ProcessSignalDeps, "sendSignalAlert" | "lowSignalQueue" | "lowSignalStore">,
  payload: SignalAlertPayload,
): Promise<void> {
  const score = payload.score;
  const ticker = payload.ticker.toUpperCase();
  if (score >= 85) {
    await deps.sendSignalAlert(payload);
    await deps.lowSignalStore.set(`${ALERT_SENT_KEY_PREFIX}${ticker}`, "1", "EX", ALERT_SENT_TTL_SEC);
    return;
  }

  if (score >= 60) {
    const key = `${ALERT_SENT_KEY_PREFIX}${ticker}`;
    const sent = await deps.lowSignalStore.get(key);
    if (sent) return;
    await deps.sendSignalAlert(payload);
    await deps.lowSignalStore.set(key, "1", "EX", ALERT_SENT_TTL_SEC);
    return;
  }

  await deps.lowSignalQueue.add(BATCH_LOW_SIGNALS_JOB_NAME, {
    ticker: payload.ticker,
    score: payload.score,
    ts: Date.now(),
  });
}

async function defaultGetUsersWithMatchingCriteria(_input: {
  ticker: string;
  patternType: string;
  confidence: number;
  score: number;
}): Promise<Array<Record<string, unknown>>> {
  const dbMaybe = prisma as unknown as {
    user?: {
      findMany?: (args?: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };
  if (!dbMaybe.user?.findMany) return [];
  try {
    return await dbMaybe.user.findMany({});
  } catch {
    return [];
  }
}

export async function runProcessSignalJob(
  input: ProcessSignalJobInput,
  depsInput?: Partial<ProcessSignalDeps>,
): Promise<ProcessSignalResult> {
  const redis = depsInput ? null : getCacheRedis();
  const idempotencyStore =
    depsInput?.idempotencyStore ??
    (depsInput
      ? ({
          get: async () => null,
          set: async () => "OK",
          del: async () => 1,
        } as Pick<ReturnType<typeof getCacheRedis>, "set" | "get" | "del">)
      : (redis ?? getCacheRedis()));
  const deps: ProcessSignalDeps = {
    db: depsInput?.db ?? prisma,
    alertQueue: depsInput?.alertQueue ?? new Queue(ALERT_QUEUE_NAME, { connection: redis ?? getCacheRedis() }),
    dlqQueue:
      depsInput?.dlqQueue ?? new Queue(PROCESS_SIGNAL_DLQ_NAME, { connection: redis ?? getCacheRedis() }),
    idempotencyStore,
    fetchRecentNews: depsInput?.fetchRecentNews ?? defaultFetchRecentNews,
    classifySentiment: depsInput?.classifySentiment ?? defaultClassifySentiment,
    fetchMacroContext: depsInput?.fetchMacroContext ?? defaultFetchMacroContext,
    generateSignalBrief: depsInput?.generateSignalBrief ?? defaultGenerateSignalBrief,
    scoreSignal: depsInput?.scoreSignal ?? defaultScoreSignal,
    fetchMarketRegime: depsInput?.fetchMarketRegime ?? (depsInput ? localFallbackMarketRegime : getMarketRegime),
    logAlphaJournal:
      depsInput?.logAlphaJournal ??
      (depsInput
        ? (async () => undefined)
        : recordAlphaJournalEvent),
    sendSignalAlert: depsInput?.sendSignalAlert ?? defaultSendSignalAlert,
    lowSignalQueue:
      depsInput?.lowSignalQueue ??
      (depsInput
        ? ({
            add: async () => ({} as never),
          } as Pick<Queue, "add">)
        : new Queue(BATCH_LOW_SIGNALS_QUEUE_NAME, { connection: redis ?? getCacheRedis() })),
    lowSignalStore:
      depsInput?.lowSignalStore ??
      ((depsInput
        ? ({
            get: async () => null,
            set: async () => "OK",
            rpush: async () => 1,
            lrange: async () => [],
            del: async () => 0,
          } as LowSignalStore)
        : ((redis ?? getCacheRedis()) as unknown as LowSignalStore))),
    getUsersWithMatchingCriteria: depsInput?.getUsersWithMatchingCriteria ?? defaultGetUsersWithMatchingCriteria,
  };

  if (!input.signalId?.trim()) {
    throw new Error("signalId is required");
  }

  const lockKey = `process-signal:lock:${input.signalId}`;
  const doneKey = `process-signal:done:${input.signalId}`;
  const alreadyDone = await deps.idempotencyStore.get(doneKey);
  if (alreadyDone) {
    const existing = await deps.db.signal.findUnique({ where: { id: input.signalId } });
    return {
      signalId: input.signalId,
      alertsQueued: 0,
      score: existing?.score ?? 0,
    };
  }
  const lock = await deps.idempotencyStore.set(lockKey, "1", "EX", 120, "NX");
  if (lock !== "OK") {
    const existing = await deps.db.signal.findUnique({ where: { id: input.signalId } });
    return {
      signalId: input.signalId,
      alertsQueued: 0,
      score: existing?.score ?? 0,
    };
  }

  let succeeded = false;
  return withRetry("process_signal_job", async () => {
    const signal = await deps.db.signal.findUnique({
      where: { id: input.signalId },
    });
    if (!signal) throw new Error(`Signal not found: ${input.signalId}`);

    const technicalData = (signal.technical_data ?? {}) as Record<string, unknown>;
    const news = await deps.fetchRecentNews(signal.ticker);
    const sentiment = await deps.classifySentiment({ ticker: signal.ticker, news });
    const macro = await deps.fetchMacroContext(signal.ticker);

    const regime = await getMarketRegime(signal.ticker);

    const brief = await deps.generateSignalBrief({
      ticker: signal.ticker,
      pattern_type: signal.pattern_type,
      confidence: signal.confidence,
      rsi: Number(technicalData.rsi ?? 50),
      macd: Number(technicalData.macd ?? 0),
      volume_ratio: Number(technicalData.volume_ratio ?? 1),
      support_level: Number(technicalData.support_level ?? 0),
      price_position: Number(technicalData.price_position ?? 0.5),
      historical_count: signal.historical_count ?? 0,
      win_rate: signal.win_rate ?? 0,
      avg_return_10d: signal.avg_return_10d ?? 0,
      max_drawdown: signal.max_drawdown ?? 0,
      recent_news: news.map((n) => n.title),
      market_sentiment: sentiment.label,
      sector_trend: macro.sectorTrend,
      vix: macro.vix,
      regime: regime.regime,
      regime_description: regime.description,
    });

    const technical = computeTechnicalScore(technicalData, signal.confidence);
    const history = computeHistoryScore(signal.win_rate, signal.avg_return_10d, signal.max_drawdown);
    const sentimentScore = clampScore(sentiment.score);
    const fundamentals = 50;
    const macroScore = computeMacroScore(macro);
    const scored = await deps.scoreSignal({
      technical,
      history,
      sentiment: sentimentScore,
      fundamentals,
      macro: macroScore,
    });

    let finalScore = scored.score;
    const setupType = signal.pattern_type.toLowerCase();
    if (setupType.includes("breakout")) {
      finalScore *= regime.weights.breakout;
    } else if (setupType.includes("oversold") || setupType.includes("bounce")) {
      finalScore *= regime.weights.mean_reversion;
    } else if (setupType.includes("momentum") || setupType.includes("volume")) {
      finalScore *= regime.weights.momentum;
    }
    finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

    const updated = await deps.db.signal.update({
      where: { id: signal.id },
      data: {
        brief_pl: brief.pl,
        brief_en: brief.en,
        score: finalScore,
        scoring_reasoning: `${scored.reasoning} | regime=${regime.regime} confidence=${regime.confidence}`,
        marketRegime: regime.regime,
        regimeConfidence: regime.confidence,
      },
    });

    await deps.logAlphaJournal({
      ts: new Date().toISOString(),
      feature: "market_regime_ai",
      symbol: signal.ticker.toUpperCase(),
      impactScore: clampScore(finalScore - scored.score),
      details: `Regime ${regime.regime} (${regime.confidence}%) applied to setup ${signal.pattern_type}.`,
      metadata: {
        patternType: signal.pattern_type,
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        baseScore: scored.score,
        finalScore,
      },
    });

    try {
      const signalDna = await getSignalDnaSummary(updated.id).catch(() => null);
      const topTwin = signalDna?.twins?.[0];
      const signalDnaField = topTwin
        ? `Top twin: ${topTwin.ticker} ${topTwin.date} → ${topTwin.resultPct.toFixed(2)}%`
        : "Brak wystarczających danych historycznych.";
      const dividendData = await maybeGetDividendData(updated.ticker);
      const supportLevel = Number(technicalData.support_level);
      const resistanceLevel = Number(technicalData.resistance_level);
      const entry = Number(technicalData.entry_price);
      const stopLoss = Number(technicalData.stop_loss);
      const takeProfit = Number(technicalData.take_profit);
      const resolvedEntry = Number.isFinite(entry) ? entry : Number(technicalData.current_price ?? supportLevel ?? 0);
      const resolvedSl = Number.isFinite(stopLoss)
        ? stopLoss
        : Number.isFinite(supportLevel)
          ? supportLevel * 0.99
          : resolvedEntry * 0.97;
      const resolvedTp = Number.isFinite(takeProfit)
        ? takeProfit
        : Number.isFinite(resistanceLevel)
          ? resistanceLevel
          : Number.isFinite(supportLevel)
            ? supportLevel * 1.05
            : resolvedEntry * 1.06;
      const risk = Math.max(0.0001, resolvedEntry - resolvedSl);
      const reward = Math.max(0, resolvedTp - resolvedEntry);
      const riskRewardRatio = Number((reward / risk).toFixed(4));
      const narrativeContext: NarrativeContext = {
        signal: {
          ticker: updated.ticker,
          setupType: updated.pattern_type,
          rsiValue: Number(technicalData.rsi ?? 50),
          volumeRatio: Number(technicalData.volume_ratio ?? 1),
          score: updated.score ?? 0,
        },
        regime,
        dna: {
          avgResultPct: signalDna?.avgResultPct ?? 0,
          winRate: signalDna?.winRate ?? 0,
          bestCase: signalDna?.bestCase ?? 0,
          worstCase: signalDna?.worstCase ?? 0,
          topTwin: topTwin
            ? { ticker: topTwin.ticker, date: topTwin.date, resultPct: topTwin.resultPct }
            : null,
          twinsCount: signalDna?.twins?.length ?? 0,
        },
        exitLevels: {
          entry: Number(resolvedEntry.toFixed(4)),
          sl: Number(resolvedSl.toFixed(4)),
          tp: Number(resolvedTp.toFixed(4)),
          riskRewardRatio,
        },
        dividendData,
      };
      const narrative = await generateNarrative(narrativeContext);
      await deps.db.signal.update({
        where: { id: updated.id },
        data: {
          narrativeHeadline: narrative.headline,
          narrativeBody: narrative.body,
          narrativeRisk: narrative.riskNote,
          narrativeConfidence: narrative.confidence,
        },
      });
      await routeDiscordAlert(deps, {
        ticker: updated.ticker,
        signal: updated.pattern_type,
        score: updated.score ?? 0,
        brief: updated.brief_en ?? updated.brief_pl ?? "",
        confidence: updated.confidence,
        timeframe: "1D",
        setup: updated.pattern_type,
        logicalChannel: updated.pattern_type,
        marketRegime: regime.regime,
        regimeConfidence: regime.confidence,
        playbookAction: buildPlaybookAction(regime, updated.pattern_type),
        signalDna: signalDnaField,
        narrativeHeadline: narrative.headline,
        narrativeBody: narrative.body,
        narrativeRisk: narrative.riskNote,
        narrativeConfidence: narrative.confidence,
        entry: resolvedEntry,
        stopLoss: resolvedSl,
        takeProfit: resolvedTp,
      });
    } catch (error) {
      await deps.dlqQueue.add("discord:signal:failed", {
        signalId: updated.id,
        ticker: updated.ticker,
        pattern: updated.pattern_type,
        score: updated.score ?? 0,
        err: error instanceof Error ? error.message : String(error),
        failedAt: new Date().toISOString(),
      });
      processSignalLogger.error({
        msg: "discord_signal_send_failed",
        signalId: updated.id,
        err: error instanceof Error ? error.message : String(error),
      });
    }

    const users = await deps.getUsersWithMatchingCriteria({
      ticker: updated.ticker,
      patternType: updated.pattern_type,
      confidence: updated.confidence,
      score: updated.score ?? 0,
    });
    for (const user of users) {
      await deps.alertQueue.add("alert:push", { signal: updated, user });

      const userId = (user as { id?: string })?.id;
      if (userId) {
        const lastTrade = await deps.db.virtualTrade.findFirst({
          where: { userId },
          orderBy: { executed_at: "desc" },
        });
        if (lastTrade) {
          processSignalLogger.debug({
            msg: "paper_trade_snapshot_ready",
            userId,
            ticker: lastTrade.ticker,
          });
        }
      }
    }

    processSignalLogger.info({
      msg: "signal_processed",
      signalId: updated.id,
      ticker: updated.ticker,
      score: updated.score,
      alertsQueued: users.length,
    });

    const out = {
      signalId: updated.id,
      alertsQueued: users.length,
      score: updated.score ?? 0,
    };
    succeeded = true;
    return out;
  }).catch(async (error) => {
    await deps.dlqQueue.add("process:signal:failed", {
      input,
      err: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
    });
    processSignalLogger.error({
      msg: "process_signal_failed",
      signalId: input.signalId,
      err: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }).finally(async () => {
    if (succeeded) {
      await deps.idempotencyStore.set(doneKey, "1", "EX", 60 * 60 * 24);
    }
    await deps.idempotencyStore.del(lockKey);
  });
}

export function registerProcessSignal(
  _processSignalQueue?: Pick<Queue, "add">,
): { queue: Queue; worker: Worker; alertQueue: Queue; dlqQueue: Queue; lowSignalQueue: Queue; lowSignalWorker: Worker } {
  const queueConnection = getCacheRedis();
  const workerConnection = getCacheRedis();
  const queue = new Queue(PROCESS_SIGNAL_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  const alertQueue = new Queue(ALERT_QUEUE_NAME, { connection: queueConnection });
  const dlqQueue = new Queue(PROCESS_SIGNAL_DLQ_NAME, { connection: queueConnection });
  const lowSignalQueue = new Queue(BATCH_LOW_SIGNALS_QUEUE_NAME, { connection: queueConnection });

  const worker = new Worker(
    PROCESS_SIGNAL_QUEUE_NAME,
    async (job) => {
      processSignalLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const result = await runProcessSignalJob(job.data as ProcessSignalJobInput, { alertQueue, dlqQueue });
      processSignalLogger.info({ msg: "end", jobId: job.id, ...result });
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    processSignalLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  const lowSignalWorker = new Worker(
    BATCH_LOW_SIGNALS_QUEUE_NAME,
    async (job) => {
      if (job.name !== BATCH_LOW_SIGNALS_JOB_NAME) return;
      const redisStore = getCacheRedis() as unknown as LowSignalStore;
      const data = job.data as { ticker?: string; score?: number; ts?: number; flushOnly?: boolean };
      if (data.flushOnly) {
        const rows = await redisStore.lrange(LOW_SIGNAL_BUFFER_KEY, 0, -1);
        if (rows.length === 0) return;
        const now = Date.now();
        const items: Array<{ ticker: string; score: number }> = rows
          .map((raw) => {
            try {
              return JSON.parse(raw) as { ticker: string; score: number; ts: number };
            } catch {
              return null;
            }
          })
          .filter((x): x is { ticker: string; score: number; ts: number } => Boolean(x))
          .filter((x) => now - x.ts <= LOW_SIGNAL_WINDOW_MS)
          .map((x) => ({ ticker: x.ticker, score: x.score }));
        await redisStore.del(LOW_SIGNAL_BUFFER_KEY);
        if (items.length > 0) {
          await sendRadarSummaryWebhook(items);
        }
        return;
      }
      const payload = JSON.stringify({
        ticker: data.ticker,
        score: data.score,
        ts: data.ts ?? Date.now(),
      });
      await redisStore.rpush(LOW_SIGNAL_BUFFER_KEY, payload);
    },
    { connection: workerConnection },
  );

  lowSignalWorker.on("failed", (job, err) => {
    processSignalLogger.error({
      msg: "low_signal_worker_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  void lowSignalQueue.add(
    BATCH_LOW_SIGNALS_JOB_NAME,
    { flushOnly: true },
    { repeat: { every: LOW_SIGNAL_WINDOW_MS }, jobId: "batch-low-signals-every-5-min" },
  );

  return { queue, worker, alertQueue, dlqQueue, lowSignalQueue, lowSignalWorker };
}

export async function enqueueProcessSignal(queue: Queue, signalId: string): Promise<void> {
  await queue.add(PROCESS_SIGNAL_JOB_NAME, { signalId });
}
