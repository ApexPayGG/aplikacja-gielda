import { createHash } from "node:crypto";
import { prisma } from "../../db/index";

type PaperTradeRow = {
  ticker: string;
  pnlPct: number | null;
  exitAt: Date | null;
};

type TrackRecordRow = {
  id: string;
  userId: string;
  publicHash: string;
  winRate: number;
  totalTrades: number;
  avgReturn: number;
  bestTradePct: number;
  worstTradePct: number;
  generatedAt: Date;
};

type DbLike = {
  paperTrade: {
    findMany: (args: Record<string, unknown>) => Promise<PaperTradeRow[]>;
  };
  trackRecord: {
    create: (args: { data: Record<string, unknown> }) => Promise<TrackRecordRow>;
    findUnique: (args: { where: { publicHash: string } }) => Promise<TrackRecordRow | null>;
  };
};

export type TrackRecordGenerateResult = {
  userId: string;
  publicHash: string;
  winRate: number;
  totalTrades: number;
  avgReturn: number;
  bestTradePct: number;
  worstTradePct: number;
  generatedAt: Date;
  bestTrade: { symbol: string; pct: number } | null;
  worstTrade: { symbol: string; pct: number } | null;
  maxWinStreak: number;
};

export type PublicTrackRecord = {
  publicHash: string;
  winRate: number;
  totalTrades: number;
  avgReturn: number;
  bestTradePct: number;
  worstTradePct: number;
  generatedAt: Date;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function computeMaxWinStreak(trades: PaperTradeRow[]): number {
  let maxStreak = 0;
  let currentStreak = 0;
  for (const trade of trades) {
    if ((trade.pnlPct ?? 0) > 0) {
      currentStreak += 1;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      continue;
    }
    currentStreak = 0;
  }
  return maxStreak;
}

function makePublicHash(userId: string, generatedAt: Date): string {
  return createHash("sha256").update(`${userId}:${generatedAt.toISOString()}`).digest("hex");
}

export function createTrackRecordService(customDb?: DbLike) {
  const db = customDb ?? (prisma as unknown as DbLike);

  async function generateTrackRecord(userIdInput: string): Promise<TrackRecordGenerateResult> {
    const userId = String(userIdInput ?? "").trim();
    if (!userId) throw new Error("Missing userId");

    const trades = await db.paperTrade.findMany({
      where: { userId, status: "CLOSED" },
      orderBy: { exitAt: "asc" },
      select: { ticker: true, pnlPct: true, exitAt: true },
    });

    if (trades.length === 0) {
      throw new Error("No CLOSED paper trades found for this user");
    }

    const normalized = trades
      .filter((trade) => Number.isFinite(trade.pnlPct))
      .map((trade) => ({
        symbol: String(trade.ticker ?? "").toUpperCase(),
        pct: Number(trade.pnlPct ?? 0),
      }));

    if (normalized.length === 0) {
      throw new Error("No CLOSED paper trades with pnlPct found for this user");
    }

    const wins = normalized.filter((trade) => trade.pct > 0).length;
    const totalTrades = normalized.length;
    const winRate = roundMetric((wins / totalTrades) * 100);
    const avgReturn = roundMetric(normalized.reduce((acc, trade) => acc + trade.pct, 0) / totalTrades);
    const bestTrade = normalized.reduce((best, current) => (current.pct > best.pct ? current : best));
    const worstTrade = normalized.reduce((worst, current) => (current.pct < worst.pct ? current : worst));
    const maxWinStreak = computeMaxWinStreak(
      trades.filter((trade) => Number.isFinite(trade.pnlPct)),
    );

    const generatedAt = new Date();
    const publicHash = makePublicHash(userId, generatedAt);
    const created = await db.trackRecord.create({
      data: {
        userId,
        publicHash,
        winRate,
        totalTrades,
        avgReturn,
        bestTradePct: roundMetric(bestTrade.pct),
        worstTradePct: roundMetric(worstTrade.pct),
        generatedAt,
      },
    });

    return {
      userId: created.userId,
      publicHash: created.publicHash,
      winRate: created.winRate,
      totalTrades: created.totalTrades,
      avgReturn: created.avgReturn,
      bestTradePct: created.bestTradePct,
      worstTradePct: created.worstTradePct,
      generatedAt: created.generatedAt,
      bestTrade,
      worstTrade,
      maxWinStreak,
    };
  }

  async function getPublicTrackRecord(publicHashInput: string): Promise<PublicTrackRecord | null> {
    const publicHash = String(publicHashInput ?? "").trim();
    if (!publicHash) throw new Error("Missing public hash");

    const row = await db.trackRecord.findUnique({ where: { publicHash } });
    if (!row) return null;

    return {
      publicHash: row.publicHash,
      winRate: row.winRate,
      totalTrades: row.totalTrades,
      avgReturn: row.avgReturn,
      bestTradePct: row.bestTradePct,
      worstTradePct: row.worstTradePct,
      generatedAt: row.generatedAt,
    };
  }

  return { generateTrackRecord, getPublicTrackRecord };
}

let trackRecordServiceSingleton: ReturnType<typeof createTrackRecordService> | null = null;

function getTrackRecordService() {
  if (!trackRecordServiceSingleton) {
    trackRecordServiceSingleton = createTrackRecordService();
  }
  return trackRecordServiceSingleton;
}

export async function generateTrackRecord(userId: string): Promise<TrackRecordGenerateResult> {
  return getTrackRecordService().generateTrackRecord(userId);
}

export async function getPublicTrackRecord(hash: string): Promise<PublicTrackRecord | null> {
  return getTrackRecordService().getPublicTrackRecord(hash);
}
