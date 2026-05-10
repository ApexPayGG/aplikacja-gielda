import { prisma } from "../../db/index";

export type VolatilityHeatmapRow = {
  year: number;
  month: number;
  volatility: number;
  avgReturn: number;
};

export type VolatilityHeatmapResponse = {
  symbol: string;
  heatmap: VolatilityHeatmapRow[];
  mostVolatileMonth: string;
  leastVolatileMonth: string;
};

type QuotePoint = {
  timestamp: Date;
  close: string | number;
};

type DbLike = {
  quote: {
    findMany: (args: Record<string, unknown>) => Promise<QuotePoint[]>;
  };
};

type MonthlyBucket = {
  returns: number[];
  sumReturns: number;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function createVolatilityService(customDb?: DbLike) {
  const db = customDb ?? (prisma as unknown as DbLike);

  async function getVolatilityHeatmap(symbolInput: string): Promise<VolatilityHeatmapResponse> {
    const symbol = String(symbolInput ?? "").trim().toUpperCase();
    if (!symbol) throw new Error("Missing symbol");

    const quotes = await db.quote.findMany({
      where: { symbol },
      orderBy: [{ timestamp: "asc" }],
      select: { timestamp: true, close: true },
    });

    if (quotes.length < 2) {
      throw new Error("Not enough quote history to calculate volatility");
    }

    const monthly = new Map<string, MonthlyBucket>();
    let previousClose: number | null = null;
    let previousYear = -1;
    let previousMonth = -1;

    for (const quote of quotes) {
      const close = Number(quote.close);
      if (!Number.isFinite(close) || close <= 0) continue;

      const year = quote.timestamp.getUTCFullYear();
      const month = quote.timestamp.getUTCMonth() + 1;

      if (previousClose !== null && previousClose > 0 && previousYear === year && previousMonth === month) {
        const ret = close / previousClose - 1;
        const key = `${year}-${String(month).padStart(2, "0")}`;
        const bucket = monthly.get(key) ?? { returns: [], sumReturns: 0 };
        bucket.returns.push(ret);
        bucket.sumReturns += ret;
        monthly.set(key, bucket);
      }

      previousClose = close;
      previousYear = year;
      previousMonth = month;
    }

    const heatmap: VolatilityHeatmapRow[] = [];
    for (const [key, bucket] of monthly.entries()) {
      if (bucket.returns.length === 0) continue;
      const [yearPart, monthPart] = key.split("-");
      const year = Number(yearPart);
      const month = Number(monthPart);
      heatmap.push({
        year,
        month,
        volatility: sampleStdDev(bucket.returns) * 100,
        avgReturn: (bucket.sumReturns / bucket.returns.length) * 100,
      });
    }

    if (heatmap.length === 0) {
      throw new Error("Not enough monthly quote history to calculate volatility");
    }

    const monthStats = new Map<number, { volatilitySum: number; count: number }>();
    for (const row of heatmap) {
      const current = monthStats.get(row.month) ?? { volatilitySum: 0, count: 0 };
      current.volatilitySum += row.volatility;
      current.count += 1;
      monthStats.set(row.month, current);
    }

    let mostMonth = 1;
    let leastMonth = 1;
    let mostAvg = Number.NEGATIVE_INFINITY;
    let leastAvg = Number.POSITIVE_INFINITY;

    for (const [month, stat] of monthStats.entries()) {
      const avgVol = stat.volatilitySum / stat.count;
      if (avgVol > mostAvg) {
        mostAvg = avgVol;
        mostMonth = month;
      }
      if (avgVol < leastAvg) {
        leastAvg = avgVol;
        leastMonth = month;
      }
    }

    heatmap.sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));

    return {
      symbol,
      heatmap,
      mostVolatileMonth: MONTH_NAMES[mostMonth - 1] ?? MONTH_NAMES[0],
      leastVolatileMonth: MONTH_NAMES[leastMonth - 1] ?? MONTH_NAMES[0],
    };
  }

  return { getVolatilityHeatmap };
}

let volatilityServiceSingleton: ReturnType<typeof createVolatilityService> | null = null;

function getVolatilityService() {
  if (!volatilityServiceSingleton) {
    volatilityServiceSingleton = createVolatilityService();
  }
  return volatilityServiceSingleton;
}

export async function getVolatilityHeatmap(symbol: string): Promise<VolatilityHeatmapResponse> {
  return getVolatilityService().getVolatilityHeatmap(symbol);
}
