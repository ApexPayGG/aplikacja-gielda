import { prisma } from "../db/index";

interface BuildLiveSetupRankingInput {
  exchange?: string;
  limit: number;
}

export interface LiveSetupRankingRow {
  setup: string;
  signals: number;
  avgBaseScore: number;
  avgLiveScore: number;
  avgConfidence: number;
  freshnessHours: number;
  edge: "hot" | "warm" | "cold";
  diagnostics: {
    freshnessPenaltyPts: number;
    volatilityPenaltyPts: number;
    confidenceBoostPts: number;
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function round2(x: number): number {
  return Number(x.toFixed(2));
}

function scoreEdge(avgLiveScore: number): "hot" | "warm" | "cold" {
  if (avgLiveScore >= 72) return "hot";
  if (avgLiveScore >= 55) return "warm";
  return "cold";
}

function computeLiveScore(baseScore: number, ageHours: number, maxDrawdown: number | null): number {
  const ageDecay = Math.exp(-0.035 * Math.max(0, ageHours));
  const volatilityPenalty = clamp01((maxDrawdown ?? 0) / 40) * 0.4;
  const score = baseScore * ageDecay * (1 - volatilityPenalty);
  return Math.max(0, Math.min(100, score));
}

export async function buildLiveSetupRanking(
  input: BuildLiveSetupRankingInput,
  db: typeof prisma = prisma,
): Promise<LiveSetupRankingRow[]> {
  const now = Date.now();
  const from = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.signal.findMany({
    where: {
      created_at: { gte: from },
      ...(input.exchange ? { exchange: input.exchange } : {}),
    },
    select: {
      pattern_type: true,
      score: true,
      confidence: true,
      created_at: true,
      max_drawdown: true,
    },
  });

  const grouped = new Map<
    string,
    Array<{ baseScore: number; confidence: number; ageHours: number; maxDrawdown: number | null }>
  >();

  for (const row of rows) {
    const baseScore = Number(row.score ?? 0);
    if (baseScore <= 0) continue;
    const ageHours = (now - row.created_at.getTime()) / (60 * 60 * 1000);
    const bucket = grouped.get(row.pattern_type) ?? [];
    bucket.push({
      baseScore,
      confidence: row.confidence,
      ageHours,
      maxDrawdown: row.max_drawdown ?? null,
    });
    grouped.set(row.pattern_type, bucket);
  }

  const ranking: LiveSetupRankingRow[] = [];
  for (const [setup, signals] of grouped.entries()) {
    const count = signals.length;
    if (count === 0) continue;
    const avgBaseScore = signals.reduce((acc, s) => acc + s.baseScore, 0) / count;
    const avgConfidence = signals.reduce((acc, s) => acc + s.confidence, 0) / count;
    const freshnessHours = signals.reduce((acc, s) => acc + s.ageHours, 0) / count;
    const avgLiveScore =
      signals.reduce((acc, s) => acc + computeLiveScore(s.baseScore, s.ageHours, s.maxDrawdown), 0) / count;
    const freshnessPenaltyPts = avgBaseScore - avgLiveScore;
    const avgVolPenaltyPts =
      signals.reduce((acc, s) => {
        const ageDecay = Math.exp(-0.035 * Math.max(0, s.ageHours));
        const volPenalty = clamp01((s.maxDrawdown ?? 0) / 40) * 0.4;
        return acc + s.baseScore * ageDecay * volPenalty;
      }, 0) / count;
    const confidenceBoostPts = Math.max(-8, Math.min(8, (avgConfidence - 50) * 0.16));
    ranking.push({
      setup,
      signals: count,
      avgBaseScore: round2(avgBaseScore),
      avgLiveScore: round2(avgLiveScore),
      avgConfidence: round2(avgConfidence),
      freshnessHours: round2(freshnessHours),
      edge: scoreEdge(avgLiveScore),
      diagnostics: {
        freshnessPenaltyPts: round2(-Math.abs(freshnessPenaltyPts)),
        volatilityPenaltyPts: round2(-Math.abs(avgVolPenaltyPts)),
        confidenceBoostPts: round2(confidenceBoostPts),
      },
    });
  }

  ranking.sort((a, b) => b.avgLiveScore - a.avgLiveScore || b.signals - a.signals);
  return ranking.slice(0, input.limit);
}
