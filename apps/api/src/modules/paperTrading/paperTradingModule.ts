import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/index";
import { getCacheRedis } from "../../redis";

export type PaperTrade = {
  id: string;
  userId: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryAt: Date;
  exitAt?: Date;
  status: "OPEN" | "CLOSED";
  pnl?: number;
  pnlPct?: number;
  signalId?: string;
  marketRegime?: string;
};

export type BehavioralSnapshot = {
  userId: string;
  biases: string[];
  avgWinPct: number;
  avgLossPct: number;
  avgHoldingWinHours: number;
  avgHoldingLossHours: number;
  calculatedAt: Date;
};

type DbLike = {
  paperTrade: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  behavioralSnapshot: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
  quote: {
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
};

const db = prisma as unknown as DbLike;

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asPaperTrade(row: Record<string, unknown>): PaperTrade {
  return {
    id: String(row.id),
    userId: String(row.userId),
    ticker: String(row.ticker),
    direction: String(row.direction) as "LONG" | "SHORT",
    entryPrice: toNumber(row.entryPrice),
    exitPrice: row.exitPrice !== null && row.exitPrice !== undefined ? toNumber(row.exitPrice) : undefined,
    quantity: toNumber(row.quantity),
    entryAt: new Date(String(row.entryAt)),
    exitAt: row.exitAt ? new Date(String(row.exitAt)) : undefined,
    status: String(row.status) as "OPEN" | "CLOSED",
    pnl: row.pnl !== null && row.pnl !== undefined ? toNumber(row.pnl) : undefined,
    pnlPct: row.pnlPct !== null && row.pnlPct !== undefined ? toNumber(row.pnlPct) : undefined,
    signalId: row.signalId ? String(row.signalId) : undefined,
    marketRegime: row.marketRegime ? String(row.marketRegime) : undefined,
  };
}

function calcPnl(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number, quantity: number): { pnl: number; pnlPct: number } {
  const gross = direction === "LONG" ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity;
  const base = entryPrice * quantity;
  const pnlPct = base > 0 ? (gross / base) * 100 : 0;
  return { pnl: Number(gross.toFixed(4)), pnlPct: Number(pnlPct.toFixed(4)) };
}

function holdingHours(entryAt: Date, exitAt: Date): number {
  return Math.max(0, (exitAt.getTime() - entryAt.getTime()) / (1000 * 60 * 60));
}

export async function openTrade(
  userId: string,
  ticker: string,
  direction: "LONG" | "SHORT",
  entryPrice: number,
  quantity: number,
  signalId?: string,
): Promise<PaperTrade> {
  const created = await db.paperTrade.create({
    data: {
      userId,
      ticker: ticker.toUpperCase(),
      direction,
      entryPrice,
      quantity,
      signalId: signalId ?? null,
      status: "OPEN",
      entryAt: new Date(),
    },
  });
  return asPaperTrade(created);
}

export async function closeTrade(tradeId: string, exitPrice: number): Promise<PaperTrade> {
  const trade = await db.paperTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error(`Paper trade not found: ${tradeId}`);
  if (String(trade.status) !== "OPEN") throw new Error(`Trade ${tradeId} is not OPEN`);

  const { pnl, pnlPct } = calcPnl(
    String(trade.direction) as "LONG" | "SHORT",
    toNumber(trade.entryPrice),
    exitPrice,
    toNumber(trade.quantity),
  );
  const updated = await db.paperTrade.update({
    where: { id: tradeId },
    data: {
      exitPrice,
      exitAt: new Date(),
      status: "CLOSED",
      pnl,
      pnlPct,
    },
  });
  await analyzeBehavior(String(trade.userId));
  return asPaperTrade(updated);
}

export async function getPortfolio(userId: string): Promise<{ openPositions: PaperTrade[]; totalUnrealizedPnl: number }> {
  const openRows = await db.paperTrade.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { entryAt: "desc" },
  });
  const openPositions = openRows.map(asPaperTrade);

  let totalUnrealizedPnl = 0;
  for (const trade of openPositions) {
    const latestQuote = await db.quote.findFirst({
      where: { symbol: trade.ticker },
      orderBy: { timestamp: "desc" },
    });
    const currentPrice = latestQuote ? toNumber(latestQuote.close, trade.entryPrice) : trade.entryPrice;
    const { pnl } = calcPnl(trade.direction, trade.entryPrice, currentPrice, trade.quantity);
    totalUnrealizedPnl += pnl;
  }

  return { openPositions, totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(4)) };
}

export async function getTradeHistory(userId: string): Promise<PaperTrade[]> {
  const rows = await db.paperTrade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { exitAt: "desc" },
  });
  return rows.map(asPaperTrade);
}

export async function analyzeBehavior(userId: string): Promise<BehavioralSnapshot> {
  const closedRows = await db.paperTrade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { exitAt: "desc" },
    take: 20,
  });
  const trades = closedRows.map(asPaperTrade);

  const winners = trades.filter((t) => (t.pnlPct ?? 0) > 0 && t.exitAt);
  const losers = trades.filter((t) => (t.pnlPct ?? 0) < 0 && t.exitAt);

  const avgWinPct = winners.length > 0 ? winners.reduce((acc, t) => acc + (t.pnlPct ?? 0), 0) / winners.length : 0;
  const avgLossPct = losers.length > 0 ? losers.reduce((acc, t) => acc + (t.pnlPct ?? 0), 0) / losers.length : 0;
  const avgHoldingWinHours =
    winners.length > 0
      ? winners.reduce((acc, t) => acc + holdingHours(t.entryAt, t.exitAt as Date), 0) / winners.length
      : 0;
  const avgHoldingLossHours =
    losers.length > 0 ? losers.reduce((acc, t) => acc + holdingHours(t.entryAt, t.exitAt as Date), 0) / losers.length : 0;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const trades24h = await db.paperTrade.count({
    where: { userId, entryAt: { gte: last24h } },
  });

  const biases: string[] = [];
  if (avgHoldingLossHours > 0 && avgHoldingWinHours < avgHoldingLossHours * 0.5) biases.push("CUTS_WINNERS_EARLY");
  if (avgLossPct < -5 && avgHoldingLossHours > 48) biases.push("HOLDS_LOSERS_TOO_LONG");
  if (trades24h > 3) biases.push("OVERTRADING");

  const snapshotRow = await db.behavioralSnapshot.create({
    data: {
      userId,
      biases,
      avgWinPct: Number(avgWinPct.toFixed(4)),
      avgLossPct: Number(avgLossPct.toFixed(4)),
      avgHoldingWinHours: Number(avgHoldingWinHours.toFixed(4)),
      avgHoldingLossHours: Number(avgHoldingLossHours.toFixed(4)),
      calculatedAt: now,
    },
  });

  const snapshot: BehavioralSnapshot = {
    userId,
    biases,
    avgWinPct: toNumber(snapshotRow.avgWinPct),
    avgLossPct: toNumber(snapshotRow.avgLossPct),
    avgHoldingWinHours: toNumber(snapshotRow.avgHoldingWinHours),
    avgHoldingLossHours: toNumber(snapshotRow.avgHoldingLossHours),
    calculatedAt: new Date(String(snapshotRow.calculatedAt)),
  };

  const redis = getCacheRedis();
  await redis.set(`paper:coach:last:${userId}`, JSON.stringify(snapshot), "EX", 60 * 10);
  return snapshot;
}

async function coachAiDescription(snapshot: BehavioralSnapshot): Promise<string> {
  const fallback = `Twój profil tradera: ${snapshot.biases.join(", ") || "BRAK"}.\nŚredni zysk: ${snapshot.avgWinPct.toFixed(2)}%, średnia strata: ${snapshot.avgLossPct.toFixed(2)}%.`;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const prompt = `Twój profil tradera: ${snapshot.biases.join(", ") || "BRAK"}. avgWin: ${snapshot.avgWinPct.toFixed(2)}%, avgLoss: ${snapshot.avgLossPct.toFixed(2)}%. Napisz max 3 zdania po polsku.`;
    const msg = await client.messages.create({
      model,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim().replace(/\s+/g, " ") : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function getCoachSnapshot(userId: string): Promise<{ snapshot: BehavioralSnapshot | null; aiDescription: string }> {
  const redis = getCacheRedis();
  const cached = await redis.get(`paper:coach:last:${userId}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as BehavioralSnapshot;
      return { snapshot: parsed, aiDescription: await coachAiDescription(parsed) };
    } catch {
      // continue to DB fallback
    }
  }

  const row = await db.behavioralSnapshot.findFirst({
    where: { userId },
    orderBy: { calculatedAt: "desc" },
  });
  if (!row) return { snapshot: null, aiDescription: "Brak danych do analizy behawioralnej." };
  const snapshot: BehavioralSnapshot = {
    userId: String(row.userId),
    biases: Array.isArray(row.biases) ? (row.biases as string[]) : [],
    avgWinPct: toNumber(row.avgWinPct),
    avgLossPct: toNumber(row.avgLossPct),
    avgHoldingWinHours: toNumber(row.avgHoldingWinHours),
    avgHoldingLossHours: toNumber(row.avgHoldingLossHours),
    calculatedAt: new Date(String(row.calculatedAt)),
  };
  return { snapshot, aiDescription: await coachAiDescription(snapshot) };
}
