import Anthropic from "@anthropic-ai/sdk";
import { PolygonClient } from "../../../../../packages/data/src/polygon/client";
import { fetchEodhdDaily } from "../../scrapers/eodhd.scraper";
import { fetchFinnhubCompanyNews, fetchFinnhubQuoteDetailed } from "../../scrapers/finnhub.scraper";
import {
  computeIntradayChangePct,
  computeMa200,
  detectEarningsEventFromHeadlines,
  detectMa200Break,
  normalizeNewsSentimentTicker,
} from "./smartNarrativeCache.service";
import type {
  MarketIntelSignals,
  NarrativeActPayload,
  NewsSentimentActTier,
  ProviderContext,
  ProviderNewsItem,
  ProviderStatus,
} from "./newsSentiment.types";

type FilterableNewsItem = ProviderNewsItem & {
  providerMetadata?: Record<string, unknown>;
};

const COMPANY_ALIAS_MAP: Readonly<Record<string, readonly string[]>> = {
  AAPL: ["Apple", "Apple Inc.", "Apple Inc"],
  MSFT: ["Microsoft", "Microsoft Corp.", "Microsoft Corporation"],
  GOOGL: ["Alphabet", "Google"],
  GOOG: ["Alphabet", "Google"],
  META: ["Meta Platforms", "Facebook", "Meta"],
  AMZN: ["Amazon"],
  NVDA: ["Nvidia", "NVIDIA"],
  TSLA: ["Tesla"],
  INTC: ["Intel"],
  AMD: ["Advanced Micro Devices", "AMD"],
  AVGO: ["Broadcom"],
  JPM: ["JPMorgan", "JPMorgan Chase"],
  V: ["Visa"],
  MA: ["Mastercard"],
  XOM: ["Exxon", "Exxon Mobil", "ExxonMobil"],
  JNJ: ["Johnson & Johnson"],
  WMT: ["Walmart"],
  PG: ["Procter & Gamble", "P&G"],
  "BRK.B": ["Berkshire Hathaway"],
  AXP: ["American Express"],
  CDL: ["CDL"],
  MAG7: ["Magnificent Seven"],
};

export function normalizeTickerSymbol(ticker: string): string {
  return normalizeNewsSentimentTicker(ticker);
}

export function getCompanyAliasesForTicker(ticker: string): readonly string[] {
  return COMPANY_ALIAS_MAP[normalizeTickerSymbol(ticker)] ?? [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractProviderRelatedTickers(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) return [];

  const tickers = new Set<string>();
  const related = metadata.related;
  if (typeof related === "string") {
    for (const part of related.split(",")) {
      const normalized = normalizeTickerSymbol(part);
      if (normalized) tickers.add(normalized);
    }
  }

  for (const key of ["symbol", "ticker", "symbols", "tickers"] as const) {
    const value = metadata[key];
    if (typeof value === "string") {
      const normalized = normalizeTickerSymbol(value);
      if (normalized) tickers.add(normalized);
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          const normalized = normalizeTickerSymbol(entry);
          if (normalized) tickers.add(normalized);
        }
      }
    }
  }

  return [...tickers];
}

export function hasExactTickerToken(text: string, ticker: string): boolean {
  const normalizedTicker = normalizeTickerSymbol(ticker);
  if (!normalizedTicker) return false;
  const pattern = new RegExp(`(?<![A-Z0-9.])${escapeRegex(normalizedTicker)}(?![A-Z0-9.])`, "i");
  return pattern.test(text);
}

function buildAliasRegex(alias: string): RegExp {
  const trimmed = alias.trim();
  return new RegExp(`(?:^|[^\\w&])${escapeRegex(trimmed)}(?:[^\\w]|$)`, "i");
}

export function hasCompanyAliasMatch(text: string, ticker: string): boolean {
  const aliases = getCompanyAliasesForTicker(ticker);
  return aliases.some((alias) => buildAliasRegex(alias).test(text));
}

export function headlineHasTargetSignal(headline: string, targetTicker: string): boolean {
  return hasExactTickerToken(headline, targetTicker) || hasCompanyAliasMatch(headline, targetTicker);
}

export function headlineHasForeignCompanySignal(headline: string, targetTicker: string): boolean {
  const normalizedTarget = normalizeTickerSymbol(targetTicker);

  for (const [ticker, aliases] of Object.entries(COMPANY_ALIAS_MAP)) {
    if (normalizeTickerSymbol(ticker) === normalizedTarget) {
      continue;
    }

    if (hasExactTickerToken(headline, ticker)) {
      return true;
    }

    if (aliases.some((alias) => buildAliasRegex(alias).test(headline))) {
      return true;
    }
  }

  return false;
}

export function isNewsItemRelevantToTicker(item: FilterableNewsItem, targetTicker: string): boolean {
  const normalizedTarget = normalizeTickerSymbol(targetTicker);
  if (!normalizedTarget) return false;

  const headlineTargetMatch = headlineHasTargetSignal(item.headline, normalizedTarget);
  const relatedTickers = extractProviderRelatedTickers(item.providerMetadata);
  const providerTickerMatch = relatedTickers.includes(normalizedTarget);
  const foreignCompanySignal = headlineHasForeignCompanySignal(item.headline, normalizedTarget);

  if (headlineTargetMatch) {
    return true;
  }

  if (providerTickerMatch && !foreignCompanySignal) {
    return true;
  }

  return false;
}

export function sanitizeNewsForTicker(
  items: FilterableNewsItem[],
  targetTicker: string,
): ProviderNewsItem[] {
  const normalizedTarget = normalizeTickerSymbol(targetTicker);
  const sanitized: ProviderNewsItem[] = [];

  for (const item of items) {
    if (isNewsItemRelevantToTicker(item, normalizedTarget)) {
      sanitized.push({
        headline: item.headline,
        source: item.source,
        datetime: item.datetime,
        url: item.url,
      });
      continue;
    }

    console.debug(`[NewsFilter] Rejected item unrelated to ${normalizedTarget}: ${item.headline}`);
  }

  return sanitized;
}

export const SP500_WARM_TICKERS: readonly string[] = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JPM",
  "V", "XOM", "LLY", "JNJ", "WMT", "MA", "PG", "AVGO", "HD", "CVX",
  "MRK", "ABBV", "COST", "PEP", "KO", "ADBE", "CRM", "MCD", "CSCO", "ACN",
  "TMO", "NFLX", "AMD", "LIN", "ABT", "DHR", "WFC", "DIS", "TXN", "PM",
  "INTC", "VZ", "CMCSA", "NEE", "RTX", "QCOM", "HON", "AMGN", "IBM", "UNP",
];

function emptyProviderStatus(): ProviderStatus {
  return {
    anthropic: "skipped",
    finnhub: "skipped",
    eodhd: "skipped",
    polygon: "skipped",
  };
}

function parseJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
}

function toEodhdSymbol(ticker: string): string {
  return `${normalizeNewsSentimentTicker(ticker)}.US`;
}

async function safeFinnhubNews(ticker: string, status: ProviderStatus): Promise<FilterableNewsItem[]> {
  if (!process.env.FINNHUB_API_KEY?.trim()) {
    status.finnhub = "missing_key";
    return [];
  }
  try {
    const rows = await fetchFinnhubCompanyNews(ticker, 14);
    status.finnhub = "ok";
    return rows.map((row) => ({
      headline: row.headline,
      source: row.source || "finnhub",
      datetime: row.datetime < 1e12 ? row.datetime * 1000 : row.datetime,
      url: row.url,
      providerMetadata: row as unknown as Record<string, unknown>,
    }));
  } catch {
    status.finnhub = "error";
    return [];
  }
}

async function safeFinnhubQuote(
  ticker: string,
  status: ProviderStatus,
): Promise<{ price: number; open: number } | null> {
  if (!process.env.FINNHUB_API_KEY?.trim()) {
    status.finnhub = "missing_key";
    return null;
  }
  try {
    const quote = await fetchFinnhubQuoteDetailed(ticker);
    status.finnhub = "ok";
    return { price: quote.close, open: quote.open };
  } catch {
    status.finnhub = status.finnhub === "ok" ? "ok" : "error";
    return null;
  }
}

async function safeEodhdCloses(ticker: string, status: ProviderStatus): Promise<number[]> {
  if (!process.env.EODHD_API_KEY?.trim()) {
    status.eodhd = "missing_key";
    return [];
  }
  try {
    const bars = await fetchEodhdDaily({
      symbol: toEodhdSymbol(ticker),
      range: "1y",
      period: "d",
    });
    status.eodhd = "ok";
    return bars.map((bar) => bar.close).filter((value) => Number.isFinite(value));
  } catch {
    status.eodhd = "error";
    return [];
  }
}

async function safePolygonCloses(ticker: string, status: ProviderStatus): Promise<number[]> {
  if (!process.env.POLYGON_API_KEY?.trim()) {
    status.polygon = "missing_key";
    return [];
  }
  try {
    const polygon = new PolygonClient({ apiKey: process.env.POLYGON_API_KEY.trim() });
    const quote = await polygon.getLatestQuote(ticker);
    status.polygon = "ok";
    const close = quote.close ?? quote.price;
    return Number.isFinite(close) ? [close] : [];
  } catch {
    status.polygon = "error";
    return [];
  }
}

export async function fetchNewsSentimentProviderContext(
  tickerInput: string,
  previousPrice: number | null = null,
): Promise<ProviderContext> {
  const ticker = normalizeNewsSentimentTicker(tickerInput);
  const providerStatus = emptyProviderStatus();

  const [rawNews, quote, eodhdCloses, polygonCloses] = await Promise.all([
    safeFinnhubNews(ticker, providerStatus),
    safeFinnhubQuote(ticker, providerStatus),
    safeEodhdCloses(ticker, providerStatus),
    safePolygonCloses(ticker, providerStatus),
  ]);

  const news = sanitizeNewsForTicker(rawNews, ticker);

  const dailyCloses = eodhdCloses;
  const currentPrice = quote?.price ?? polygonCloses.at(-1) ?? dailyCloses.at(-1) ?? null;
  const referencePrice = quote?.open ?? previousPrice ?? dailyCloses.at(-2) ?? null;
  const ma200 = computeMa200(dailyCloses);
  const intradayChangePct =
    currentPrice != null && referencePrice != null
      ? computeIntradayChangePct(currentPrice, referencePrice)
      : 0;
  const earningsEventDetected = detectEarningsEventFromHeadlines(news.map((item) => item.headline));
  const ma200Break =
    currentPrice != null && ma200 != null
      ? detectMa200Break(currentPrice, ma200, previousPrice)
      : false;

  const signals: MarketIntelSignals = {
    intradayChangePct,
    earningsEventDetected,
    currentPrice,
    previousPrice,
    ma200,
    ma200Break,
  };

  return {
    ticker,
    news,
    dailyCloses,
    quote,
    providerStatus,
    signals,
  };
}

function buildDeterministicAct(
  tier: NewsSentimentActTier,
  ticker: string,
  news: ProviderNewsItem[],
  signals: MarketIntelSignals,
): NarrativeActPayload {
  const headlines = news.slice(0, 5).map((item) => item.headline);
  const summaryByTier: Record<NewsSentimentActTier, string> = {
    ACT_1_CORE_HISTORY: `${ticker} core history narrative (deterministic fallback). ${news.length} headlines scanned.`,
    ACT_2_PRESENT_SENTIMENT: `${ticker} present sentiment snapshot. Intraday move ${signals.intradayChangePct.toFixed(2)}%.`,
    ACT_3_SCENARIOS: `${ticker} scenario outlook. MA200 ${signals.ma200 != null ? signals.ma200.toFixed(2) : "n/a"}.`,
  };

  return {
    tier,
    summary: summaryByTier[tier],
    bulletPoints: headlines.length > 0 ? headlines : [`No external headlines available for ${ticker}.`],
    sentimentScore: signals.intradayChangePct > 3 ? -0.3 : 0.1,
    sources: ["deterministic-fallback"],
    generatedAt: new Date().toISOString(),
    degraded: true,
  };
}

async function generateActWithAnthropic(
  tier: NewsSentimentActTier,
  ticker: string,
  news: ProviderNewsItem[],
  signals: MarketIntelSignals,
  providerStatus: ProviderStatus,
): Promise<NarrativeActPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    providerStatus.anthropic = "missing_key";
    return buildDeterministicAct(tier, ticker, news, signals);
  }

  const headlines = news.slice(0, 8).map((item) => `- ${item.headline}`).join("\n");
  const prompt =
    `Generate a concise market intel narrative for ${ticker}.\n` +
    `Tier: ${tier}\n` +
    `Signals: intradayChangePct=${signals.intradayChangePct.toFixed(2)}, ma200=${signals.ma200 ?? "n/a"}, earnings=${signals.earningsEventDetected}\n` +
    `Headlines:\n${headlines || "- none"}\n` +
    `Return JSON: { "summary": string, "bulletPoints": string[], "sentimentScore": number }`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const firstBlock = message.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";
    const parsed = parseJsonFromText(text) as {
      summary?: string;
      bulletPoints?: string[];
      sentimentScore?: number;
    } | null;

    providerStatus.anthropic = "ok";
    if (!parsed?.summary) {
      return buildDeterministicAct(tier, ticker, news, signals);
    }

    const sentimentScore = Number(parsed.sentimentScore);
    return {
      tier,
      summary: parsed.summary.trim(),
      bulletPoints: Array.isArray(parsed.bulletPoints)
        ? parsed.bulletPoints.map(String).slice(0, 6)
        : [],
      sentimentScore: Number.isFinite(sentimentScore) ? sentimentScore : null,
      sources: ["anthropic", "finnhub"],
      generatedAt: new Date().toISOString(),
      degraded: false,
    };
  } catch {
    providerStatus.anthropic = "error";
    return buildDeterministicAct(tier, ticker, news, signals);
  }
}

export async function generateNewsSentimentActs(
  context: ProviderContext,
): Promise<{ act1: NarrativeActPayload; act2: NarrativeActPayload; act3: NarrativeActPayload }> {
  const providerStatus: ProviderStatus = { ...context.providerStatus };
  const [act1, act2, act3] = await Promise.all([
    generateActWithAnthropic("ACT_1_CORE_HISTORY", context.ticker, context.news, context.signals, providerStatus),
    generateActWithAnthropic("ACT_2_PRESENT_SENTIMENT", context.ticker, context.news, context.signals, providerStatus),
    generateActWithAnthropic("ACT_3_SCENARIOS", context.ticker, context.news, context.signals, providerStatus),
  ]);
  context.providerStatus = providerStatus;
  return { act1, act2, act3 };
}

export function resolveWarmCacheTickers(customTickers?: string[]): string[] {
  if (Array.isArray(customTickers) && customTickers.length > 0) {
    return [...new Set(customTickers.map((ticker) => normalizeNewsSentimentTicker(ticker)).filter(Boolean))];
  }
  return [...SP500_WARM_TICKERS];
}
