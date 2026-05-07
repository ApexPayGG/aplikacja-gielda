/**
 * Deterministyczny silnik scoringu zrównoważenia dywidendy (Sprint 2).
 */
import { prisma } from "../db/index";
import type { SustainabilityBreakdown, SustainabilityMathInputs } from "../types/sustainability";

const PAYOUT_WEIGHT = 0.35;
const COVERAGE_WEIGHT = 0.35;
const CONSISTENCY_WEIGHT = 0.3;

export function scorePayoutRatio(ratio: number | null): { score: number; insight: string } {
  if (ratio == null || Number.isNaN(ratio)) {
    return { score: 50, insight: "Payout: brak EPS_TTM lub rocznej dywidendy (DPS); neutralny wynik 50." };
  }
  if (ratio < 0.3) return { score: 100, insight: `Payout ${(ratio * 100).toFixed(1)}% (<30%) — bardzo bezpieczny.` };
  if (ratio < 0.4) return { score: 90, insight: `Payout ${(ratio * 100).toFixed(1)}% (30–40%) — dobry.` };
  if (ratio < 0.6) return { score: 70, insight: `Payout ${(ratio * 100).toFixed(1)}% (40–60%) — umiarkowany.` };
  if (ratio < 0.8) return { score: 40, insight: `Payout ${(ratio * 100).toFixed(1)}% (60–80%) — podwyższone ryzyko.` };
  return { score: 0, insight: `Payout ${(ratio * 100).toFixed(1)}% (≥80%) — wysokie ryzyko.` };
}

export function scoreFcfCoverage(ratio: number | null, fcfMissing: boolean): { score: number; insight: string } {
  if (fcfMissing) {
    return { score: 50, insight: "FCF: brak danych — pokrycie nieznane; neutralny wynik 50." };
  }
  if (ratio == null || Number.isNaN(ratio)) {
    return { score: 50, insight: "FCF: nie można obliczyć pokrycia (np. brak akcji); neutralny wynik 50." };
  }
  if (ratio < 0.5) return { score: 100, insight: `Pokrycie FCF ${(ratio * 100).toFixed(1)}% (<50% FCF na dywidendę) — bardzo dobre.` };
  if (ratio < 1.0) return { score: 80, insight: `Pokrycie FCF ${(ratio * 100).toFixed(1)}% (50–100%) — akceptowalne.` };
  if (ratio < 1.5) return { score: 50, insight: `Pokrycie FCF ${(ratio * 100).toFixed(1)}% (100–150%) — napięte.` };
  return { score: 0, insight: `Pokrycie FCF ${(ratio * 100).toFixed(1)}% (≥150% FCF) — dywidenda przekracza FCF.` };
}

export function countDividendCuts(yoyGrowth: number[]): number {
  return yoyGrowth.filter((g) => g < 0).length;
}

export function growthVolatilityStdPct(yoyGrowth: number[]): number {
  if (yoyGrowth.length < 2) return 0;
  const mean = yoyGrowth.reduce((a, b) => a + b, 0) / yoyGrowth.length;
  const variance =
    yoyGrowth.reduce((sum, g) => sum + (g - mean) ** 2, 0) / Math.max(1, yoyGrowth.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

export function scoreConsistency(
  dpsHistory: number[],
  yoyGrowth: number[],
): { score: number; insight: string } {
  if (dpsHistory.length < 2) {
    return {
      score: 70,
      insight: "Spójność: za mało lat historii DPS (<2) — częściowy wynik 70.",
    };
  }
  const cuts = countDividendCuts(yoyGrowth);
  const vol = growthVolatilityStdPct(yoyGrowth);

  if (cuts >= 2 || vol > 15) {
    return {
      score: 30,
      insight: `Spójność: ${cuts} cięć YoY, zmienność wzrostów σ≈${vol.toFixed(1)}% — słaba.`,
    };
  }
  if (cuts === 1 || (vol >= 5 && vol <= 15)) {
    return {
      score: 70,
      insight: `Spójność: ${cuts} cięć, σ≈${vol.toFixed(1)}% — średnia stabilność.`,
    };
  }
  if (cuts === 0 && vol < 5) {
    return {
      score: 100,
      insight: `Spójność: brak cięć, niska zmienność (σ≈${vol.toFixed(1)}%) — bardzo dobra.`,
    };
  }
  return {
    score: 70,
    insight: `Spójność: ${cuts} cięć, σ≈${vol.toFixed(1)}% — średnia (domyślny bucket).`,
  };
}

export function computeYoYGrowthFromDpsSeries(dpsAscending: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < dpsAscending.length; i++) {
    const prev = dpsAscending[i - 1]!;
    const cur = dpsAscending[i]!;
    if (prev <= 0) out.push(cur > 0 ? 100 : 0);
    else out.push(((cur - prev) / prev) * 100);
  }
  return out;
}

/**
 * Czysta funkcja — używana w testach i po pobraniu danych z DB.
 */
export function computeSustainabilityBreakdownFromInputs(
  input: SustainabilityMathInputs,
): SustainabilityBreakdown {
  const insights: string[] = [];

  const sorted = [...input.dividendTotalsByYear].sort((a, b) => a.year - b.year);
  const last5 = sorted.slice(-5);
  const dpsHistory = last5.map((r) => r.totalAmount);
  const yoyGrowth = computeYoYGrowthFromDpsSeries(dpsHistory);

  let payoutRatio: number | null = null;
  if (
    input.epsTtm != null &&
    input.epsTtm > 0 &&
    input.latestAnnualDps != null &&
    input.latestAnnualDps >= 0
  ) {
    payoutRatio = input.latestAnnualDps / input.epsTtm;
  }
  const payout = scorePayoutRatio(payoutRatio);
  insights.push(payout.insight);

  const fcfMissing = input.fcf == null || input.fcf <= 0;
  let fcfCoverage: number | null = null;
  if (!fcfMissing && input.latestAnnualDps != null && input.sharesOutstanding != null && input.sharesOutstanding > 0) {
    const totalDiv = input.latestAnnualDps * input.sharesOutstanding;
    fcfCoverage = totalDiv / input.fcf!;
  } else if (!fcfMissing && input.fcf! > 0) {
    fcfCoverage = null;
  }
  const coverage = scoreFcfCoverage(fcfCoverage, fcfMissing);
  insights.push(coverage.insight);

  const consistency = scoreConsistency(dpsHistory, yoyGrowth);
  insights.push(consistency.insight);

  const finalScore = Math.round(
    PAYOUT_WEIGHT * payout.score +
      COVERAGE_WEIGHT * coverage.score +
      CONSISTENCY_WEIGHT * consistency.score,
  );

  return {
    payoutScore: payout.score,
    coverageScore: coverage.score,
    consistencyScore: consistency.score,
    payoutRatio,
    fcfCoverage,
    dpsHistory,
    yoyGrowth,
    finalScore,
    explanation: insights.join(" "),
  };
}

async function loadMathInputs(symbol: string): Promise<SustainabilityMathInputs> {
  const sym = symbol.trim().toUpperCase();

  const [epsRow, dpsRows, fcfRows, shRows] = await Promise.all([
    prisma.fundamental.findUnique({
      where: { symbol_metric_year: { symbol: sym, metric: "eps_ttm", year: 0 } },
    }),
    prisma.dividendHistory.findMany({
      where: { symbol: sym },
      orderBy: { year: "desc" },
      take: 5,
      select: { year: true, totalAmount: true },
    }),
    prisma.fundamental.findMany({
      where: { symbol: sym, metric: "fcf", year: { gt: 0 } },
      orderBy: { year: "desc" },
      take: 1,
    }),
    prisma.fundamental.findMany({
      where: { symbol: sym, metric: "shares_outstanding", year: { gt: 0 } },
      orderBy: { year: "desc" },
      take: 1,
    }),
  ]);

  const epsTtm = epsRow ? Number(epsRow.value) : null;
  const latestYearRow = dpsRows[0];
  const latestAnnualDps = latestYearRow ? latestYearRow.totalAmount : null;

  const fcfRow = fcfRows[0];
  const fcf = fcfRow ? Number(fcfRow.value) : null;
  const fcfYear = fcfRow?.year;

  let sharesOutstanding: number | null = null;
  if (fcfYear != null) {
    const shAligned = await prisma.fundamental.findUnique({
      where: { symbol_metric_year: { symbol: sym, metric: "shares_outstanding", year: fcfYear } },
    });
    if (shAligned) sharesOutstanding = Number(shAligned.value);
  }
  if (sharesOutstanding == null && shRows[0]) {
    sharesOutstanding = Number(shRows[0].value);
  }

  const dividendTotalsByYear = [...dpsRows]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ year: r.year, totalAmount: r.totalAmount }));

  return {
    epsTtm,
    latestAnnualDps,
    fcf,
    sharesOutstanding,
    dividendTotalsByYear,
  };
}

export async function calculateSustainabilityScore(symbol: string): Promise<SustainabilityBreakdown> {
  const input = await loadMathInputs(symbol);
  return computeSustainabilityBreakdownFromInputs(input);
}
