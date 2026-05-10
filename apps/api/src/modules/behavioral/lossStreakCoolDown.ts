import { prisma } from "../../db/index";

const MIN_LOSS_STREAK = 3;
const COOLDOWN_MINUTES = 30;

type DbLike = {
  paperTrade: {
    findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  };
};

const db = prisma as unknown as DbLike;

export type LossStreakCoolDownStatus = {
  active: boolean;
  lossStreak: number;
  unlocksAt: string | null;
  message: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.valueOf()) ? null : d;
}

export async function getLossStreakCoolDown(userId: string): Promise<LossStreakCoolDownStatus> {
  const closed = await db.paperTrade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { exitAt: "desc" },
    take: 50,
  });

  let lossStreak = 0;
  let latestLossExitAt: Date | null = null;

  for (const row of closed) {
    const pnl = toNumber(row.pnl, 0);
    if (pnl < 0) {
      lossStreak += 1;
      if (!latestLossExitAt) {
        latestLossExitAt = toDate(row.exitAt);
      }
      continue;
    }
    break;
  }

  if (lossStreak < MIN_LOSS_STREAK || !latestLossExitAt) {
    return {
      active: false,
      lossStreak,
      unlocksAt: null,
      message: "No cooldown active",
    };
  }

  const unlockAtMs = latestLossExitAt.getTime() + COOLDOWN_MINUTES * 60_000;
  const active = Date.now() < unlockAtMs;
  const unlocksAt = new Date(unlockAtMs).toISOString();

  return {
    active,
    lossStreak,
    unlocksAt: active ? unlocksAt : null,
    message: active
      ? `${lossStreak} consecutive losses detected. Trading locked for 30 minutes.`
      : "No cooldown active",
  };
}
