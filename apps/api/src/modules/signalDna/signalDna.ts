import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/index";
import { getCacheRedis } from "../../redis";

export type SignalTwin = {
  signalId: string;
  ticker: string;
  date: string;
  similarity: number;
  setupType: string;
  entryPrice: number;
  resultPct: number;
  marketRegime: string;
  description: string;
};

export type SignalDnaSummary = {
  twins: SignalTwin[];
  avgResultPct: number;
  winRate: number;
  bestCase: number;
  worstCase: number;
  aiNarrative: string;
};

type SignalRow = {
  id: string;
  ticker: string;
  pattern_type: string;
  marketRegime: string | null;
  created_at: Date;
  technical_data: unknown;
};

type PaperTradeRow = {
  ticker: string;
  signalId: string | null;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number | null;
  status: "OPEN" | "CLOSED";
  entryAt: Date;
  marketRegime: string | null;
};

type CacheLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSec: number) => Promise<unknown>;
};

type SignalDnaDeps = {
  db: {
    signal: {
      findUnique: (args: { where: { id: string } }) => Promise<SignalRow | null>;
    };
    paperTrade: {
      findMany: (args: Record<string, unknown>) => Promise<PaperTradeRow[]>;
    };
  };
  cache: CacheLike;
  narrate: (input: { twins: SignalTwin[]; avgResultPct: number; winRate: number }) => Promise<string>;
};

const CACHE_TTL_SEC = 60 * 60;

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getFeatures(technicalData: unknown): { rsi: number; volumeRatio: number; atr: number } {
  const t = (technicalData ?? {}) as Record<string, unknown>;
  return {
    rsi: asNum(t.rsi, 50),
    volumeRatio: asNum(t.volume_ratio, 1),
    atr: asNum(t.atr, 0),
  };
}

/** RSI / volume / ATR proximity + same-ticker bump — reused by Reverse Screener (ATR should be comparable scale, e.g. ATR/close). */
export function calcSignalDnaSimilarity(
  current: { rsi: number; volumeRatio: number; atr: number; ticker: string },
  historical: { rsi: number; volumeRatio: number; atr: number; ticker: string },
): number {
  let points = 0;
  if (Math.abs(current.rsi - historical.rsi) <= 5) points += 30;
  if (Math.abs(current.volumeRatio - historical.volumeRatio) <= 0.3) points += 25;
  if (Math.abs(current.atr - historical.atr) <= 0.2) points += 25;
  if (current.ticker.toUpperCase() === historical.ticker.toUpperCase()) points += 20;
  return points;
}

function calcResultPct(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number): number {
  if (entryPrice <= 0) return 0;
  const pct =
    direction === "LONG" ? ((exitPrice - entryPrice) / entryPrice) * 100 : ((entryPrice - exitPrice) / entryPrice) * 100;
  return Number(pct.toFixed(4));
}

async function defaultNarrative(input: { twins: SignalTwin[]; avgResultPct: number; winRate: number }): Promise<string> {
  const top = input.twins[0];
  const fallback = top
    ? `Ten setup jest podobny do ${input.twins.length} historycznych konfiguracji. Średni wynik: ${input.avgResultPct.toFixed(2)}%, win rate: ${input.winRate.toFixed(2)}%. Najbliższy bliźniak: ${top.ticker} ${top.date}, wynik ${top.resultPct.toFixed(2)}%.`
    : "Brak historycznych bliźniaków dla tego setupu w ostatnich 2 latach.";
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const prompt = top
      ? `Ten setup jest podobny do ${input.twins.length} historycznych konfiguracji. Średni wynik: ${input.avgResultPct.toFixed(2)}%, win rate: ${input.winRate.toFixed(2)}%. Najbliższy bliźniak: ${top.ticker} ${top.date}, wynik ${top.resultPct.toFixed(2)}%. Max 3 zdania po polsku.`
      : "Brak historycznych bliźniaków. Napisz 2 zdania po polsku o tym, że potrzeba więcej danych.";
    const msg = await client.messages.create({
      model,
      max_tokens: 180,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim().replace(/\s+/g, " ") : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function createSignalDnaService(customDeps?: Partial<SignalDnaDeps>) {
  const deps: SignalDnaDeps = {
    db: customDeps?.db ??
      ({
        signal: prisma.signal,
        paperTrade: prisma.paperTrade,
      } as SignalDnaDeps["db"]),
    cache: customDeps?.cache ?? (getCacheRedis() as unknown as CacheLike),
    narrate: customDeps?.narrate ?? defaultNarrative,
  };

  async function findSignalTwins(signalId: string): Promise<SignalTwin[]> {
    const current = await deps.db.signal.findUnique({ where: { id: signalId } });
    if (!current) throw new Error(`Signal not found: ${signalId}`);
    const setupType = current.pattern_type;
    const marketRegime = current.marketRegime ?? "UNKNOWN";
    const currentFeatures = getFeatures(current.technical_data);
    const minDate = new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000);

    const closedTrades = await deps.db.paperTrade.findMany({
      where: {
        status: "CLOSED",
        marketRegime,
        signalId: { not: null },
        entryAt: { gte: minDate },
      },
      orderBy: { entryAt: "desc" },
      take: 200,
    });

    const twins: SignalTwin[] = [];
    for (const trade of closedTrades) {
      if (!trade.signalId || trade.exitPrice === null || trade.status !== "CLOSED") continue;
      const histSignal = await deps.db.signal.findUnique({ where: { id: trade.signalId } });
      if (!histSignal) continue;
      if (histSignal.pattern_type !== setupType) continue;
      const histFeatures = getFeatures(histSignal.technical_data);
      const similarity = calcSignalDnaSimilarity(
        { ...currentFeatures, ticker: current.ticker },
        { ...histFeatures, ticker: histSignal.ticker },
      );
      const resultPct = calcResultPct(trade.direction, asNum(trade.entryPrice), asNum(trade.exitPrice));
      twins.push({
        signalId: histSignal.id,
        ticker: histSignal.ticker,
        date: histSignal.created_at.toISOString().slice(0, 10),
        similarity,
        setupType: histSignal.pattern_type,
        entryPrice: asNum(trade.entryPrice),
        resultPct,
        marketRegime: histSignal.marketRegime ?? "UNKNOWN",
        description: `Bliźniak setupu ${histSignal.pattern_type} w reżimie ${histSignal.marketRegime ?? "UNKNOWN"}.`,
      });
    }
    return twins.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  async function getSignalDnaSummary(signalId: string): Promise<SignalDnaSummary> {
    const key = `signal_dna:${signalId}`;
    const cached = await deps.cache.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as SignalDnaSummary;
      } catch {
        // ignore cache parse errors
      }
    }
    const twins = await findSignalTwins(signalId);
    const results = twins.map((x) => x.resultPct);
    const avgResultPct = results.length ? Number((results.reduce((a, b) => a + b, 0) / results.length).toFixed(4)) : 0;
    const winRate = results.length ? Number(((results.filter((x) => x > 0).length / results.length) * 100).toFixed(2)) : 0;
    const bestCase = results.length ? Number(Math.max(...results).toFixed(4)) : 0;
    const worstCase = results.length ? Number(Math.min(...results).toFixed(4)) : 0;
    const aiNarrative = await deps.narrate({ twins, avgResultPct, winRate });
    const summary: SignalDnaSummary = { twins, avgResultPct, winRate, bestCase, worstCase, aiNarrative };
    await deps.cache.set(key, JSON.stringify(summary), "EX", CACHE_TTL_SEC);
    return summary;
  }

  return { findSignalTwins, getSignalDnaSummary };
}

let signalDnaServiceSingleton: ReturnType<typeof createSignalDnaService> | null = null;

function getSignalDnaService() {
  if (!signalDnaServiceSingleton) {
    signalDnaServiceSingleton = createSignalDnaService();
  }
  return signalDnaServiceSingleton;
}

export async function findSignalTwins(signalId: string): Promise<SignalTwin[]> {
  return getSignalDnaService().findSignalTwins(signalId);
}

export async function getSignalDnaSummary(signalId: string): Promise<SignalDnaSummary> {
  return getSignalDnaService().getSignalDnaSummary(signalId);
}
