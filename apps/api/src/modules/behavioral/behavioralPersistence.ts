import { prisma } from "../../db/index";

export type ApiEmotion = "FEAR" | "NEUTRAL" | "GREED" | "CONFIDENCE";

const API_EMOTIONS = new Set<ApiEmotion>(["FEAR", "NEUTRAL", "GREED", "CONFIDENCE"]);

export type PsycheScoresPayload = {
  fomoScore: number;
  discipline: number;
  greedControl: number;
  patience: number;
  growthScore: number;
};

export const DEFAULT_PSYCHE_SCORES: PsycheScoresPayload = {
  fomoScore: 50,
  discipline: 50,
  greedControl: 50,
  patience: 50,
  growthScore: 50,
};

function clampScore(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizePsychePayload(input: Partial<PsycheScoresPayload>): PsycheScoresPayload {
  return {
    fomoScore: clampScore(input.fomoScore),
    discipline: clampScore(input.discipline),
    greedControl: clampScore(input.greedControl),
    patience: clampScore(input.patience),
    growthScore: clampScore(input.growthScore),
  };
}

export function parseApiEmotion(raw: unknown): ApiEmotion {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (API_EMOTIONS.has(value as ApiEmotion)) {
    return value as ApiEmotion;
  }
  throw new Error("Invalid emotion. Expected FEAR | NEUTRAL | GREED | CONFIDENCE");
}

export async function createEmotionJournalEntry(input: {
  userId: string;
  emotion: ApiEmotion;
  ticker?: string | null;
  note?: string | null;
}) {
  return prisma.emotionJournalEntry.create({
    data: {
      userId: input.userId,
      emotion: input.emotion,
      ticker: input.ticker?.trim().toUpperCase() || null,
      note: input.note?.trim() || null,
    },
  });
}

export async function listEmotionJournalEntries(userId: string, limit = 20) {
  const take = Math.max(1, Math.min(100, limit));
  return prisma.emotionJournalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function createPsycheSnapshot(userId: string, payload: Partial<PsycheScoresPayload>) {
  const scores = normalizePsychePayload(payload);
  return prisma.psycheSnapshot.create({
    data: {
      userId,
      fomoScore: scores.fomoScore,
      discipline: scores.discipline,
      greedControl: scores.greedControl,
      patience: scores.patience,
      growthScore: scores.growthScore,
    },
  });
}

export async function getLatestPsycheSnapshot(userId: string): Promise<PsycheScoresPayload & { createdAt: string | null }> {
  const row = await prisma.psycheSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return { ...DEFAULT_PSYCHE_SCORES, createdAt: null };
  }
  return {
    fomoScore: row.fomoScore,
    discipline: row.discipline,
    greedControl: row.greedControl,
    patience: row.patience,
    growthScore: row.growthScore,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPsycheSnapshotHistory(userId: string, days = 30) {
  const safeDays = Math.max(1, Math.min(365, days));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.psycheSnapshot.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fomoScore: row.fomoScore,
    discipline: row.discipline,
    greedControl: row.greedControl,
    patience: row.patience,
    growthScore: row.growthScore,
    createdAt: row.createdAt.toISOString(),
  }));
}
