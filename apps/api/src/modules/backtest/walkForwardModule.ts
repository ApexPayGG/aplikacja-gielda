import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type WalkForwardStrategy = "RSI_OVERSOLD" | "BREAKOUT" | "VOLUME_SPIKE";

export type WalkForwardRunInput = {
  symbol: string;
  strategy: WalkForwardStrategy;
  months: number;
};

export type WalkForwardTrade = {
  date: string;
  action: string;
  price: number;
  outcome: number;
};

export type WalkForwardResult = {
  symbol: string;
  strategy: WalkForwardStrategy;
  months: number;
  winRate: number;
  avgReturn: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  equity: Array<{ date: string; value: number }>;
  trades: WalkForwardTrade[];
};

type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const WINDOW_DAYS = 30;
const HOLD_DAYS = 5;
const LOOKBACK = 20;
const RSI_PERIOD = 14;

function toUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function decimalToNumber(v: Prisma.Decimal | bigint | number): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

/** Wilder RSI at each index; null where undefined (need RSI_PERIOD closes of deltas). */
function buildRsiSeries(closes: number[], period = RSI_PERIOD): (number | null)[] {
  const n = closes.length;
  const rsi: (number | null)[] = Array.from({ length: n }, () => null);
  if (n < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < n; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDevSample(xs: number[]): number {
  if (xs.length <= 1) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function maxDrawdownPct(equity: Array<{ value: number }>): number {
  if (equity.length === 0) return 0;
  let peak = equity[0]!.value;
  let maxDd = 0;
  for (const p of equity) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) {
      const dd = ((peak - p.value) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return Number(maxDd.toFixed(4));
}

/** Last intraday row per UTC calendar day (avoids duplicate OHLC from multiple sources). */
function aggregateDailyBarsSimple(
  rows: Array<{
    timestamp: Date;
    open: Prisma.Decimal;
    high: Prisma.Decimal;
    low: Prisma.Decimal;
    close: Prisma.Decimal;
    volume: bigint;
  }>,
): DailyBar[] {
  const byDay = new Map<string, { row: (typeof rows)[0]; ts: number }>();
  for (const r of rows) {
    const key = toUtcDateKey(r.timestamp);
    const ts = r.timestamp.getTime();
    const prev = byDay.get(key);
    if (!prev || ts >= prev.ts) {
      byDay.set(key, { row: r, ts });
    }
  }
  const keys = [...byDay.keys()].sort();
  return keys.map((date) => {
    const r = byDay.get(date)!.row;
    return {
      date,
      open: decimalToNumber(r.open),
      high: decimalToNumber(r.high),
      low: decimalToNumber(r.low),
      close: decimalToNumber(r.close),
      volume: Number(r.volume),
    };
  });
}

function signalAtIndex(
  strategy: WalkForwardStrategy,
  bars: DailyBar[],
  i: number,
  rsi: (number | null)[],
): boolean {
  if (strategy === "RSI_OVERSOLD") {
    const v = rsi[i];
    return v != null && v < 30;
  }
  if (i < LOOKBACK) return false;
  const sliceH = bars.slice(i - LOOKBACK, i).map((b) => b.high);
  const sliceV = bars.slice(i - LOOKBACK, i).map((b) => b.volume);
  const priorHigh = Math.max(...sliceH);
  const avgVol = mean(sliceV);

  if (strategy === "BREAKOUT") {
    return bars[i]!.close > priorHigh;
  }
  // VOLUME_SPIKE
  if (avgVol <= 0) return false;
  return bars[i]!.volume > 2 * avgVol;
}

export async function runWalkForwardBacktest(
  db: PrismaClient,
  input: WalkForwardRunInput,
): Promise<WalkForwardResult> {
  const symbol = input.symbol.trim().toUpperCase();
  const months = input.months;
  const strategy = input.strategy;

  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);
  from.setUTCHours(0, 0, 0, 0);

  const rows = await db.quote.findMany({
    where: { symbol, timestamp: { gte: from } },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  const bars = aggregateDailyBarsSimple(rows);
  const n = bars.length;
  const dateToIdx = new Map(bars.map((b, idx) => [b.date, idx]));
  const closes = bars.map((b) => b.close);
  const rsi = buildRsiSeries(closes, RSI_PERIOD);

  const trades: WalkForwardTrade[] = [];
  const returns: number[] = [];

  for (let wStart = 0; wStart + WINDOW_DAYS <= n; wStart += WINDOW_DAYS) {
    const wEnd = wStart + WINDOW_DAYS;
    for (let i = wStart; i < wEnd; i++) {
      if (i + HOLD_DAYS >= n) continue;
      if (!signalAtIndex(strategy, bars, i, rsi)) continue;

      const entry = bars[i]!.close;
      if (entry <= 0) continue;
      const exitPx = bars[i + HOLD_DAYS]!.close;
      const outcomePct = ((exitPx - entry) / entry) * 100;
      returns.push(outcomePct);
      trades.push({
        date: bars[i]!.date,
        action: "BUY",
        price: Number(entry.toFixed(6)),
        outcome: Number(outcomePct.toFixed(4)),
      });
    }
  }

  const totalTrades = trades.length;
  const wins = returns.filter((r) => r > 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgReturn = totalTrades > 0 ? mean(returns) : 0;
  const retStd = stdDevSample(returns);
  const sharpeRatio =
    totalTrades > 1 && retStd > 0 ? Number(((avgReturn / retStd) * Math.sqrt(totalTrades)).toFixed(4)) : 0;

  let capital = 10_000;
  const equity: Array<{ date: string; value: number }> = [];
  if (n > 0) {
    equity.push({ date: bars[0]!.date, value: Number(capital.toFixed(4)) });
  }
  for (let t = 0; t < trades.length; t++) {
    const tr = trades[t]!;
    const idx = dateToIdx.get(tr.date) ?? -1;
    const exitIdx = idx >= 0 ? idx + HOLD_DAYS : -1;
    const exitDate = exitIdx >= 0 && exitIdx < n ? bars[exitIdx]!.date : tr.date;
    capital *= 1 + tr.outcome / 100;
    equity.push({ date: exitDate, value: Number(capital.toFixed(4)) });
  }

  const maxDrawdown = maxDrawdownPct(equity);

  return {
    symbol,
    strategy,
    months,
    winRate: Number(winRate.toFixed(4)),
    avgReturn: Number(avgReturn.toFixed(4)),
    totalTrades,
    maxDrawdown,
    sharpeRatio,
    equity,
    trades,
  };
}
