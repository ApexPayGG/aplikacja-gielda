import { prisma } from "../../db/index";

export type SkillId =
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

type SkillDefinition = {
  id: SkillId;
  name: string;
  description: string;
  unlockCondition: string;
};

type SkillProgressRow = {
  id: string;
  userId: string;
  skillId: string;
  unlockedAt: Date;
};

type PaperTradeRow = {
  ticker: string;
  pnlPct: number | null;
};

type DbLike = {
  paperTrade: {
    findMany: (args: Record<string, unknown>) => Promise<PaperTradeRow[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  mistakeLibrary: {
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  skillProgress: {
    findMany: (args: Record<string, unknown>) => Promise<SkillProgressRow[]>;
    createMany: (args: { data: Array<Record<string, unknown>>; skipDuplicates: boolean }) => Promise<{
      count: number;
    }>;
  };
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

type SkillState = {
  id: SkillId;
  name: string;
  description: string;
  unlockCondition: string;
  unlocked: boolean;
  unlockedAt: Date | null;
};

export type SkillTreeResponse = {
  skills: Array<{
    id: SkillId;
    name: string;
    description: string;
    unlockCondition: string;
    unlocked: boolean;
    unlockedAt: string | null;
  }>;
  totalUnlocked: number;
  totalSkills: number;
};

const SKILLS: SkillDefinition[] = [
  {
    id: "BASICS",
    name: "Basics",
    description: "Rozumiesz akcje i giełdę",
    unlockCondition: "Zawsze odblokowane",
  },
  {
    id: "SUPPORT_RESISTANCE",
    name: "Support & Resistance",
    description: "Rozumiesz support i resistance",
    unlockCondition: "Min. 5 zamkniętych paper trades",
  },
  {
    id: "RSI",
    name: "RSI",
    description: "Rozumiesz RSI",
    unlockCondition: "Min. 5 zamkniętych paper trades",
  },
  {
    id: "MACD",
    name: "MACD",
    description: "Rozumiesz MACD",
    unlockCondition: "Min. 5 zamkniętych paper trades",
  },
  {
    id: "FIBONACCI",
    name: "Fibonacci",
    description: "Rozumiesz poziomy Fibonacciego",
    unlockCondition: "Min. 10 zamkniętych paper trades",
  },
  {
    id: "VOLUME",
    name: "Volume",
    description: "Rozumiesz wolumen",
    unlockCondition: "Min. 10 zamkniętych paper trades",
  },
  {
    id: "RISK_MANAGEMENT",
    name: "Risk Management",
    description: "Stosujesz position sizing",
    unlockCondition: "Position Size Calculator min. 3 użycia",
  },
  {
    id: "BEHAVIORAL",
    name: "Behavioral",
    description: "Kontrolujesz emocje w tradingu",
    unlockCondition: "Min. 1 wpis w Mistake Library",
  },
  {
    id: "DIVERSIFICATION",
    name: "Diversification",
    description: "Rozumiesz dywersyfikację",
    unlockCondition: "Min. 3 różne symbole w paper trades",
  },
  {
    id: "STRATEGY",
    name: "Strategy",
    description: "Masz spójną strategię",
    unlockCondition: "Min. 20 trades i win rate > 40%",
  },
];

async function getPositionCalculatorUsageCount(
  db: DbLike,
  userId: string,
  allPaperTradesCount: number,
): Promise<number> {
  try {
    const tableCheck = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') AS exists",
    );
    if (!tableCheck[0]?.exists) {
      return allPaperTradesCount;
    }

    const columnRows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events'",
    );
    const columns = new Set(columnRows.map((row) => row.column_name));
    const userColumn = columns.has("user_id")
      ? "user_id"
      : columns.has("userId")
        ? "\"userId\""
        : null;
    const eventColumn = columns.has("event")
      ? "event"
      : columns.has("event_type")
        ? "event_type"
        : columns.has("name")
          ? "name"
          : null;

    if (!userColumn || !eventColumn) {
      return allPaperTradesCount;
    }

    const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM events WHERE ${userColumn} = $1 AND LOWER(COALESCE(${eventColumn}::text, '')) LIKE '%position%'`,
      userId,
    );

    if (Number.isFinite(rows[0]?.count)) {
      return Number(rows[0].count);
    }
  } catch {
    // Fallback heuristic if events table or columns are unavailable.
  }

  return allPaperTradesCount;
}

export function createSkillTreeService(customDb?: DbLike) {
  const db = customDb ?? (prisma as unknown as DbLike);

  async function evaluateSkills(userIdInput: string): Promise<SkillState[]> {
    const userId = String(userIdInput ?? "").trim();
    if (!userId) throw new Error("Missing userId");

    const [closedTrades, allPaperTradesCount, mistakeCount, progressRows] = await Promise.all([
      db.paperTrade.findMany({
        where: { userId, status: "CLOSED" },
        select: { ticker: true, pnlPct: true },
      }),
      db.paperTrade.count({ where: { userId } }),
      db.mistakeLibrary.count({ where: { userId } }),
      db.skillProgress.findMany({ where: { userId } }),
    ]);

    const closedTradesCount = closedTrades.length;
    const symbolsCount = new Set(
      closedTrades.map((trade) => String(trade.ticker ?? "").trim().toUpperCase()).filter(Boolean),
    ).size;
    const wins = closedTrades.filter((trade) => Number(trade.pnlPct ?? 0) > 0).length;
    const winRate = closedTradesCount > 0 ? (wins / closedTradesCount) * 100 : 0;
    const positionCalculatorUsageCount = await getPositionCalculatorUsageCount(
      db,
      userId,
      allPaperTradesCount,
    );
    const unlockedFromRules = new Set<SkillId>(["BASICS"]);

    if (closedTradesCount >= 5) {
      unlockedFromRules.add("RSI");
      unlockedFromRules.add("MACD");
      unlockedFromRules.add("SUPPORT_RESISTANCE");
    }
    if (closedTradesCount >= 10) {
      unlockedFromRules.add("FIBONACCI");
      unlockedFromRules.add("VOLUME");
    }
    if (positionCalculatorUsageCount >= 3) {
      unlockedFromRules.add("RISK_MANAGEMENT");
    }
    if (mistakeCount >= 1) {
      unlockedFromRules.add("BEHAVIORAL");
    }
    if (symbolsCount >= 3) {
      unlockedFromRules.add("DIVERSIFICATION");
    }
    if (closedTradesCount >= 20 && winRate > 40) {
      unlockedFromRules.add("STRATEGY");
    }

    const progressBySkill = new Map(progressRows.map((row) => [String(row.skillId), row]));

    return SKILLS.map((skill) => {
      const progress = progressBySkill.get(skill.id);
      const unlocked = Boolean(progress) || unlockedFromRules.has(skill.id);
      return {
        ...skill,
        unlocked,
        unlockedAt: progress?.unlockedAt ?? null,
      };
    });
  }

  async function getSkillTree(userId: string): Promise<SkillTreeResponse> {
    const states = await evaluateSkills(userId);
    return {
      skills: states.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        unlockCondition: skill.unlockCondition,
        unlocked: skill.unlocked,
        unlockedAt: skill.unlockedAt ? skill.unlockedAt.toISOString() : null,
      })),
      totalUnlocked: states.filter((s) => s.unlocked).length,
      totalSkills: SKILLS.length,
    };
  }

  async function checkSkillProgress(userIdInput: string): Promise<{ newlyUnlocked: SkillId[] }> {
    const userId = String(userIdInput ?? "").trim();
    if (!userId) throw new Error("Missing userId");

    const states = await evaluateSkills(userId);
    const toPersist = states.filter((state) => state.unlocked && !state.unlockedAt);

    if (toPersist.length > 0) {
      await db.skillProgress.createMany({
        data: toPersist.map((state) => ({
          userId,
          skillId: state.id,
        })),
        skipDuplicates: true,
      });
    }

    return {
      newlyUnlocked: toPersist.map((state) => state.id),
    };
  }

  return { getSkillTree, checkSkillProgress };
}

let skillTreeServiceSingleton: ReturnType<typeof createSkillTreeService> | null = null;

function getSkillTreeService() {
  if (!skillTreeServiceSingleton) {
    skillTreeServiceSingleton = createSkillTreeService();
  }
  return skillTreeServiceSingleton;
}

export async function getSkillTree(userId: string): Promise<SkillTreeResponse> {
  return getSkillTreeService().getSkillTree(userId);
}

export async function checkSkillProgress(userId: string): Promise<{ newlyUnlocked: SkillId[] }> {
  return getSkillTreeService().checkSkillProgress(userId);
}
