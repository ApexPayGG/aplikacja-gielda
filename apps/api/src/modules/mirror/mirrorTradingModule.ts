import { prisma } from "../../db/index";

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function clampRevenueShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(50, Math.max(0, value));
}

export async function computePaperTradeWinStats(userId: string): Promise<{ winRate: number; totalTrades: number }> {
  const trades = await prisma.paperTrade.findMany({
    where: { userId, status: "CLOSED" },
    select: { pnlPct: true },
  });
  const normalized = trades.filter((t) => Number.isFinite(t.pnlPct));
  if (normalized.length === 0) {
    return { winRate: 0, totalTrades: 0 };
  }
  const wins = normalized.filter((t) => (t.pnlPct ?? 0) > 0).length;
  return {
    winRate: roundMetric((wins / normalized.length) * 100),
    totalTrades: normalized.length,
  };
}

export async function getMirrorPermission(traderId: string): Promise<{
  enabled: boolean;
  revenueShare: number;
  followers: number;
}> {
  const row = await prisma.mirrorPermission.findUnique({
    where: { traderId },
  });
  if (!row) {
    return { enabled: false, revenueShare: 0, followers: 0 };
  }
  return {
    enabled: row.enabled,
    revenueShare: row.revenueShare,
    followers: row.followers,
  };
}

/** Upserts mirror settings for a trader. Optional `enabled` (default true) supports turning mirror off from settings. */
export async function enableMirrorTrading(
  traderId: string,
  revenueShareInput: number,
  enabled?: boolean,
): Promise<{ enabled: boolean; revenueShare: number }> {
  const revenueShare = clampRevenueShare(Number(revenueShareInput));
  const nextEnabled = enabled === undefined ? true : Boolean(enabled);

  const row = await prisma.mirrorPermission.upsert({
    where: { traderId },
    create: {
      traderId,
      enabled: nextEnabled,
      revenueShare,
      followers: 0,
    },
    update: {
      enabled: nextEnabled,
      revenueShare,
    },
  });

  return { enabled: row.enabled, revenueShare: row.revenueShare };
}

export async function followMirrorTrader(
  followerId: string,
  traderId: string,
): Promise<{ following: boolean }> {
  if (followerId === traderId) {
    throw new Error("Cannot follow yourself");
  }

  const permission = await prisma.mirrorPermission.findUnique({ where: { traderId } });
  if (!permission?.enabled) {
    throw new Error("This trader is not accepting mirror followers");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.mirrorFollower.findUnique({
      where: {
        followerId_traderId: { followerId, traderId },
      },
    });

    if (existing?.active) {
      return;
    }

    if (existing && !existing.active) {
      await tx.mirrorFollower.update({
        where: { id: existing.id },
        data: { active: true },
      });
      await tx.mirrorPermission.update({
        where: { traderId },
        data: { followers: { increment: 1 } },
      });
      return;
    }

    await tx.mirrorFollower.create({
      data: { followerId, traderId, active: true },
    });
    await tx.mirrorPermission.update({
      where: { traderId },
      data: { followers: { increment: 1 } },
    });
  });

  return { following: true };
}

export async function unfollowMirrorTrader(
  followerId: string,
  traderId: string,
): Promise<{ unfollowed: boolean }> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.mirrorFollower.findUnique({
      where: {
        followerId_traderId: { followerId, traderId },
      },
    });
    if (!existing || !existing.active) {
      return;
    }

    await tx.mirrorFollower.update({
      where: { id: existing.id },
      data: { active: false },
    });

    const perm = await tx.mirrorPermission.findUnique({ where: { traderId } });
    if (perm && perm.followers > 0) {
      await tx.mirrorPermission.update({
        where: { traderId },
        data: { followers: { decrement: 1 } },
      });
    }
  });

  return { unfollowed: true };
}

export async function listTopMirrorTraders(): Promise<
  { userId: string; winRate: number; totalTrades: number; followers: number }[]
> {
  const permissions = await prisma.mirrorPermission.findMany({
    where: { enabled: true },
    orderBy: [{ followers: "desc" }, { traderId: "asc" }],
  });

  const out: { userId: string; winRate: number; totalTrades: number; followers: number }[] = [];
  for (const p of permissions) {
    const stats = await computePaperTradeWinStats(p.traderId);
    out.push({
      userId: p.traderId,
      winRate: stats.winRate,
      totalTrades: stats.totalTrades,
      followers: p.followers,
    });
  }
  return out;
}

export async function listMirrorFollowing(followerId: string): Promise<
  { traderId: string; winRate: number; totalTrades: number; active: boolean }[]
> {
  const rows = await prisma.mirrorFollower.findMany({
    where: { followerId },
    orderBy: { createdAt: "desc" },
  });

  const result: { traderId: string; winRate: number; totalTrades: number; active: boolean }[] = [];
  for (const row of rows) {
    const stats = await computePaperTradeWinStats(row.traderId);
    result.push({
      traderId: row.traderId,
      winRate: stats.winRate,
      totalTrades: stats.totalTrades,
      active: row.active,
    });
  }
  return result;
}
