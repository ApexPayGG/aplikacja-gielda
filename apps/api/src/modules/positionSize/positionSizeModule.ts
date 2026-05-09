export type ConvictionLevel = "LOW" | "MEDIUM" | "HIGH";

export type PositionSizeParams = {
  accountSize: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  conviction: ConvictionLevel;
};

export type PositionSizeResult = {
  shares: number;
  positionValue: number;
  riskAmount: number;
  actualRiskPct: number;
  maxLoss: number;
  takeProfit1R: number;
  takeProfit2R: number;
  takeProfit3R: number;
};

const DEFAULT_RISK_PCT = 2;
const HIGH_MAX_RISK_PCT = 3;

function convictionMultiplier(conviction: ConvictionLevel): number {
  if (conviction === "LOW") return 0.5;
  if (conviction === "HIGH") return 1.25;
  return 1;
}

/**
 * Position sizing: risk-based share count from stop distance, adjusted by conviction.
 * HIGH caps effective risk at 3% of account (after 1.25x share multiplier).
 */
export function calculatePositionSize(params: PositionSizeParams): PositionSizeResult {
  const accountSize = Number(params.accountSize);
  const riskPercent = Number.isFinite(params.riskPercent) ? Number(params.riskPercent) : DEFAULT_RISK_PCT;
  const entryPrice = Number(params.entryPrice);
  const stopLossPrice = Number(params.stopLossPrice);
  const conviction = params.conviction;

  if (!Number.isFinite(accountSize) || accountSize <= 0) {
    throw new Error("accountSize must be a positive number");
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error("entryPrice must be a positive number");
  }
  if (!Number.isFinite(stopLossPrice) || stopLossPrice <= 0) {
    throw new Error("stopLossPrice must be a positive number");
  }
  if (conviction !== "LOW" && conviction !== "MEDIUM" && conviction !== "HIGH") {
    throw new Error("conviction must be LOW, MEDIUM, or HIGH");
  }

  const priceRisk = Math.abs(entryPrice - stopLossPrice);
  if (priceRisk <= 0) {
    throw new Error("entryPrice and stopLossPrice must differ");
  }

  const riskAmount = accountSize * (riskPercent / 100);
  let shares = Math.floor(riskAmount / priceRisk);
  const mult = convictionMultiplier(conviction);
  shares = Math.floor(shares * mult);

  if (conviction === "HIGH") {
    const maxRiskAmount = accountSize * (HIGH_MAX_RISK_PCT / 100);
    const maxSharesForCap = Math.floor(maxRiskAmount / priceRisk);
    shares = Math.min(shares, maxSharesForCap);
  }

  shares = Math.max(0, shares);

  const maxLoss = priceRisk * shares;
  const positionValue = shares * entryPrice;
  const actualRiskPct = accountSize > 0 ? (maxLoss / accountSize) * 100 : 0;
  const rUnit = entryPrice - stopLossPrice;
  const takeProfit1R = entryPrice + rUnit * 1;
  const takeProfit2R = entryPrice + rUnit * 2;
  const takeProfit3R = entryPrice + rUnit * 3;

  return {
    shares,
    positionValue,
    riskAmount,
    actualRiskPct,
    maxLoss,
    takeProfit1R,
    takeProfit2R,
    takeProfit3R,
  };
}
