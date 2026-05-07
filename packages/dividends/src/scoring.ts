export interface DividendHealthInput {
  years_consecutive: number;
  recent_cuts: number;
  trend: "rising" | "stable" | "falling";
  payout_ratio: number;
  dividend_yield: number;
  sector_avg_yield: number;
  cagr_5y: number;
}

export interface DividendHealthBreakdown {
  continuity: number;
  trend: number;
  safety: number;
  yield: number;
  growth: number;
  payout_ratio: number;
  cagr_5y: number;
  reasoning: string;
}

function continuityScore(recentCuts: number): number {
  if (recentCuts <= 0) return 100;
  if (recentCuts === 1) return 70;
  return 30;
}

function trendScore(trend: DividendHealthInput["trend"]): number {
  if (trend === "rising") return 100;
  if (trend === "stable") return 80;
  return 40;
}

function safetyScore(payoutRatio: number): number {
  if (payoutRatio < 60) return 100;
  if (payoutRatio <= 75) return 80;
  if (payoutRatio <= 90) return 50;
  return 20;
}

function yieldScore(dividendYield: number, sectorAvgYield: number): number {
  const diff = dividendYield - sectorAvgYield;
  if (diff >= 0) return 100;
  if (diff >= -1) return 80;
  if (diff >= -3) return 60;
  return 40;
}

function growthScore(cagr5y: number): number {
  if (cagr5y > 8) return 100;
  if (cagr5y >= 5) return 80;
  if (cagr5y >= 2) return 60;
  return 40;
}

export function calculateDividendHealth(input: DividendHealthInput): { score: number; breakdown: DividendHealthBreakdown } {
  const noDataProfile =
    input.years_consecutive <= 0 &&
    input.recent_cuts <= 0 &&
    input.payout_ratio <= 0 &&
    input.dividend_yield <= 0 &&
    input.sector_avg_yield <= 0 &&
    input.cagr_5y <= 0;

  const continuity = noDataProfile ? 0 : continuityScore(input.recent_cuts);
  const trend = noDataProfile ? 0 : trendScore(input.trend);
  const safety = noDataProfile ? 0 : safetyScore(input.payout_ratio);
  const yieldVsSector = noDataProfile ? 0 : yieldScore(input.dividend_yield, input.sector_avg_yield);
  const growth = noDataProfile ? 0 : growthScore(input.cagr_5y);

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        continuity * 0.25 + trend * 0.25 + safety * 0.25 + yieldVsSector * 0.15 + growth * 0.1,
      ),
    ),
  );

  const breakdown: DividendHealthBreakdown = {
    continuity,
    trend,
    safety,
    yield: yieldVsSector,
    growth,
    payout_ratio: input.payout_ratio,
    cagr_5y: input.cagr_5y,
    reasoning: `Score ${score} bo: continuity ${continuity}, trend ${trend}, safety ${safety}, yield ${yieldVsSector}, growth ${growth}`,
  };

  return { score, breakdown };
}
