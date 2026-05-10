export type DividendCompoundParams = {
  initialAmount: number;
  monthlyContribution: number;
  /** Annual gross dividend yield, in percent (e.g. 4.5 for 4.5%). */
  dividendYield: number;
  years: number;
};

export type DividendCompoundChartPoint = {
  year: number;
  value: number;
};

export type DividendCompoundSeries = {
  final: number;
  chart: DividendCompoundChartPoint[];
};

export type DividendCompoundResult = {
  withReinvesting: DividendCompoundSeries;
  withoutReinvesting: DividendCompoundSeries;
  difference: number;
};

const MAX_YEARS = 60;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}

/**
 * Compound dividend calculator. Simulates month-by-month:
 * - "with reinvesting": every paid dividend is added back to the balance,
 *   so it earns dividends in the following months (compound growth).
 * - "without reinvesting": dividends are paid out as cash (no compounding);
 *   the displayed value is principal grown by contributions plus accumulated
 *   cash dividends, which is a fair "total wealth" comparison.
 *
 * Yearly snapshots (including year 0) are returned for charting.
 */
export function calculateDividendCompound(params: DividendCompoundParams): DividendCompoundResult {
  const initialAmount = Number(params.initialAmount);
  const monthlyContribution = Number(params.monthlyContribution);
  const dividendYield = Number(params.dividendYield);
  const years = Math.floor(Number(params.years));

  assertFiniteNonNegative(initialAmount, "initialAmount");
  assertFiniteNonNegative(monthlyContribution, "monthlyContribution");
  assertFiniteNonNegative(dividendYield, "dividendYield");

  if (!Number.isFinite(years) || years <= 0) {
    throw new Error("years must be a positive integer");
  }
  if (years > MAX_YEARS) {
    throw new Error(`years must be <= ${MAX_YEARS}`);
  }

  const monthlyRate = dividendYield / 100 / 12;
  const months = years * 12;

  let withBalance = initialAmount;
  let withoutPrincipal = initialAmount;
  let withoutDividendCash = 0;

  const withChart: DividendCompoundChartPoint[] = [{ year: 0, value: round2(initialAmount) }];
  const withoutChart: DividendCompoundChartPoint[] = [{ year: 0, value: round2(initialAmount) }];

  for (let m = 1; m <= months; m += 1) {
    withBalance += monthlyContribution;
    withoutPrincipal += monthlyContribution;

    const reinvestedDividend = withBalance * monthlyRate;
    withBalance += reinvestedDividend;

    const cashDividend = withoutPrincipal * monthlyRate;
    withoutDividendCash += cashDividend;

    if (m % 12 === 0) {
      const year = m / 12;
      withChart.push({ year, value: round2(withBalance) });
      withoutChart.push({ year, value: round2(withoutPrincipal + withoutDividendCash) });
    }
  }

  const finalWith = round2(withBalance);
  const finalWithout = round2(withoutPrincipal + withoutDividendCash);

  return {
    withReinvesting: { final: finalWith, chart: withChart },
    withoutReinvesting: { final: finalWithout, chart: withoutChart },
    difference: round2(finalWith - finalWithout),
  };
}
