/**
 * Zapis snapshotu scoringu zrównoważenia dywidendy (Sprint 3).
 */
import type { DividendSustainabilityScore } from "@prisma/client";
import { isRedisConfigured, redisKeys } from "../config/redis";
import { prisma } from "../db/index";
import { getCacheRedis } from "../redis";
import type { SustainabilityBreakdown } from "../types/sustainability";

const DEFAULT_MODEL_VERSION = "1.0";

export async function clearSustainabilityDividendCache(symbol: string): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const key = redisKeys.sustainabilityDividend(symbol);
    await getCacheRedis().del(key);
  } catch {
    /* ignore */
  }
}

export function breakdownFromRow(row: DividendSustainabilityScore): SustainabilityBreakdown {
  if (row.componentsJson?.trim()) {
    try {
      const parsed = JSON.parse(row.componentsJson) as SustainabilityBreakdown;
      if (
        typeof parsed.payoutScore === "number" &&
        typeof parsed.finalScore === "number" &&
        Array.isArray(parsed.dpsHistory)
      ) {
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }
  return {
    payoutScore: row.payoutScore,
    coverageScore: row.coverageScore,
    consistencyScore: row.consistencyScore,
    payoutRatio: row.payoutRatio,
    fcfCoverage: row.fcfCoverage,
    dpsHistory: [],
    yoyGrowth: [],
    finalScore: row.finalScore,
    explanation: row.explanation,
  };
}

export async function saveSustainabilityScore(
  symbol: string,
  breakdown: SustainabilityBreakdown,
  modelVersion = process.env.SUSTAINABILITY_MODEL_VERSION?.trim() || DEFAULT_MODEL_VERSION,
): Promise<DividendSustainabilityScore> {
  const sym = symbol.trim().toUpperCase();
  const now = new Date();
  const componentsJson = JSON.stringify(breakdown);

  const row = await prisma.dividendSustainabilityScore.upsert({
    where: { symbol: sym },
    create: {
      symbol: sym,
      finalScore: breakdown.finalScore,
      payoutScore: breakdown.payoutScore,
      coverageScore: breakdown.coverageScore,
      consistencyScore: breakdown.consistencyScore,
      payoutRatio: breakdown.payoutRatio,
      fcfCoverage: breakdown.fcfCoverage,
      explanation: breakdown.explanation,
      componentsJson,
      lastCalculatedAt: now,
      modelVersion,
    },
    update: {
      finalScore: breakdown.finalScore,
      payoutScore: breakdown.payoutScore,
      coverageScore: breakdown.coverageScore,
      consistencyScore: breakdown.consistencyScore,
      payoutRatio: breakdown.payoutRatio,
      fcfCoverage: breakdown.fcfCoverage,
      explanation: breakdown.explanation,
      componentsJson,
      lastCalculatedAt: now,
      modelVersion,
    },
  });

  await clearSustainabilityDividendCache(sym);
  return row;
}

export async function getSustainabilityScoreRow(
  symbol: string,
): Promise<DividendSustainabilityScore | null> {
  const sym = symbol.trim().toUpperCase();
  return prisma.dividendSustainabilityScore.findUnique({ where: { symbol: sym } });
}
