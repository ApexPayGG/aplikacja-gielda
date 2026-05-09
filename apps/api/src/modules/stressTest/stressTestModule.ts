import type { PrismaClient } from "@prisma/client";

export type PositionScenarioImpact = {
  ticker: string;
  currentValue: number;
  lossValue: number;
  newValue: number;
};

export type ScenarioResult = {
  scenario: string;
  drop: number;
  portfolioLossPct: number;
  portfolioLossValue: number;
  positionsImpact: PositionScenarioImpact[];
};

export type StressTestResponse = {
  openPositionCount: number;
  scenarios: ScenarioResult[];
};

const SCENARIO_DROPS = {
  CRASH_2008: -54,
  COVID_2020: -34,
  DOT_COM_2001: -49,
} as const;

function toNum(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dropFraction(percent: number): number {
  return percent / 100;
}

/**
 * Open paper positions shocked by parallel market move `dropPercent` (e.g. -54).
 * LONG: loses when price falls. SHORT: gains when price falls (negative lossValue).
 */
function scenarioForPositions(
  scenario: string,
  dropPercent: number,
  positions: Array<{
    ticker: string;
    direction: "LONG" | "SHORT";
    quantity: number;
    currentPrice: number;
  }>,
): ScenarioResult {
  const d = dropFraction(dropPercent);
  const mult = 1 + d;

  const positionsImpact: PositionScenarioImpact[] = [];
  let portfolioLossValue = 0;
  let totalCurrent = 0;

  for (const p of positions) {
    const currentValue = p.quantity * p.currentPrice;
    totalCurrent += currentValue;
    const newPrice = p.currentPrice * mult;
    const newValue = p.quantity * newPrice;

    let lossValue: number;
    if (p.direction === "LONG") {
      lossValue = currentValue - newValue;
    } else {
      lossValue = newValue - currentValue;
    }

    portfolioLossValue += lossValue;
    positionsImpact.push({
      ticker: p.ticker,
      currentValue: Number(currentValue.toFixed(2)),
      lossValue: Number(lossValue.toFixed(2)),
      newValue: Number(newValue.toFixed(2)),
    });
  }

  const portfolioLossPct =
    totalCurrent > 0 ? Number(((portfolioLossValue / totalCurrent) * 100).toFixed(2)) : 0;

  return {
    scenario,
    drop: dropPercent,
    portfolioLossPct,
    portfolioLossValue: Number(portfolioLossValue.toFixed(2)),
    positionsImpact,
  };
}

/**
 * Loads open paper trades, marks each to latest quote close (fallback entry), runs four stress paths.
 * `customDropPct` is positive magnitude (default 20 → ‑20%).
 */
export async function runStressTest(
  prisma: PrismaClient,
  userId: string,
  customDropPct?: number,
): Promise<StressTestResponse> {
  const rows = await prisma.paperTrade.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { entryAt: "desc" },
  });

  const positions: Array<{
    ticker: string;
    direction: "LONG" | "SHORT";
    quantity: number;
    currentPrice: number;
  }> = [];

  for (const row of rows) {
    const ticker = String(row.ticker).toUpperCase();
    const direction = String(row.direction) as "LONG" | "SHORT";
    const quantity = Number(row.quantity);
    const entryPrice = Number(row.entryPrice);

    const quote = await prisma.quote.findFirst({
      where: { symbol: ticker },
      orderBy: { timestamp: "desc" },
    });
    const currentPrice = quote ? toNum(quote.close, entryPrice) : entryPrice;

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      continue;
    }

    positions.push({ ticker, direction, quantity, currentPrice });
  }

  const customFromEnv = Number(process.env.STRESS_TEST_CUSTOM_DROP_PCT);
  const customMag =
    customDropPct !== undefined && Number.isFinite(customDropPct)
      ? Math.min(100, Math.max(0, customDropPct))
      : Number.isFinite(customFromEnv) && customFromEnv >= 0 && customFromEnv <= 100
        ? customFromEnv
        : 20;

  const scenarios: ScenarioResult[] = [
    scenarioForPositions("CRASH_2008", SCENARIO_DROPS.CRASH_2008, positions),
    scenarioForPositions("COVID_2020", SCENARIO_DROPS.COVID_2020, positions),
    scenarioForPositions("DOT_COM_2001", SCENARIO_DROPS.DOT_COM_2001, positions),
    scenarioForPositions("CUSTOM", -customMag, positions),
  ];

  return {
    openPositionCount: positions.length,
    scenarios,
  };
}
