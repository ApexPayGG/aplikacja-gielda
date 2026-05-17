import type { Prisma, Quote } from "@prisma/client";
import { prisma } from "../../db/index";
import { calcSignalDnaSimilarity } from "../signalDna/signalDna";

export type ReverseScreenerTrend = "up" | "down" | "flat";

export type ReverseScreenerCurrentSetup = {
  rsi: number;
  volume: number;
  priceChange: number;
  trend: ReverseScreenerTrend;
};

export type ReverseScreenerMatch = {
  symbol: string;
  date: string;
  similarity: number;
  outcome5d: number;
  outcome10d: number;
};

export type ReverseScreenerFindResponse = {
  currentSetup: ReverseScreenerCurrentSetup;
  matches: ReverseScreenerMatch[];
  avgOutcome: number;
};

type Bar = { t: Date; o: number; h: number; l: number; c: number; v: number };

type FeatureRow = {
  rsi: number;
  volumeRatio: number;
  priceChangePct: number;
  trend: ReverseScreenerTrend;
  atrNorm: number;
};

function numDecimal(d: Prisma.Decimal): number {
  return Number(d);
}

function numVol(v: bigint): number {
  return Number(v);
}

function parseIsoDateUtc(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new Error("Invalid date (expected YYYY-MM-DD)");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function collapseToDailySorted(rows: Quote[]): Bar[] {
  const byDay = new Map<string, Quote>();
  for (const r of rows) {
    const key = dayKey(r.timestamp);
    const prev = byDay.get(key);
    if (!prev || r.timestamp.getTime() > prev.timestamp.getTime()) {
      byDay.set(key, r);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, r]) => ({
      t: r.timestamp,
      o: numDecimal(r.open),
      h: numDecimal(r.high),
      l: numDecimal(r.low),
      c: numDecimal(r.close),
      v: numVol(r.volume),
    }));
}

function wilderRsi(closes: number[], period = 14): number[] {
  const rsi = closes.map(() => Number.NaN);
  if (closes.length < period + 1) return rsi;
  let sumG = 0;
  let sumL = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) sumG += ch;
    else sumL -= ch;
  }
  let avgG = sumG / period;
  let avgL = sumL / period;
  rsi[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return rsi;
}

function trueRange(bars: Bar[], i: number): number {
  const hi = bars[i].h;
  const lo = bars[i].l;
  if (i === 0) return hi - lo;
  const pc = bars[i - 1].c;
  return Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc));
}

function atrSmaAt(bars: Bar[], i: number, period = 14): number {
  let sum = 0;
  for (let k = i - period + 1; k <= i; k++) sum += trueRange(bars, k);
  return sum / period;
}

function smaSlice(values: number[], end: number, len: number): number {
  let s = 0;
  for (let i = end - len + 1; i <= end; i++) s += values[i];
  return s / len;
}

function trendFromMas(closes: number[], i: number): ReverseScreenerTrend {
  if (i < 19) return "flat";
  const s = smaSlice(closes, i, 10);
  const l = smaSlice(closes, i, 20);
  if (s > l * 1.002) return "up";
  if (s < l * 0.998) return "down";
  return "flat";
}

function buildFeaturesAtIndex(bars: Bar[], i: number): FeatureRow | null {
  if (i < 20 || i < 14) return null;
  const closes = bars.map((b) => b.c);
  const rsiArr = wilderRsi(closes, 14);
  const rsi = rsiArr[i];
  if (!Number.isFinite(rsi)) return null;

  let volSum = 0;
  for (let j = i - 20; j < i; j++) volSum += bars[j].v;
  const volAvg = volSum / 20;
  const volumeRatio = volAvg > 0 ? bars[i].v / volAvg : 1;

  const prevC = bars[i - 1].c;
  const priceChangePct = prevC > 0 ? ((bars[i].c - prevC) / prevC) * 100 : 0;

  const rawAtr = atrSmaAt(bars, i, 14);
  const atrNorm = rawAtr && bars[i].c > 0 ? rawAtr / bars[i].c : 0;

  return {
    rsi,
    volumeRatio,
    priceChangePct,
    trend: trendFromMas(closes, i),
    atrNorm: Number.isFinite(atrNorm) ? atrNorm : 0,
  };
}

function reverseSetupSimilarity(
  anchor: FeatureRow,
  hist: FeatureRow,
  anchorTicker: string,
  histTicker: string,
): number {
  const dna = calcSignalDnaSimilarity(
    { rsi: anchor.rsi, volumeRatio: anchor.volumeRatio, atr: anchor.atrNorm, ticker: anchorTicker },
    { rsi: hist.rsi, volumeRatio: hist.volumeRatio, atr: hist.atrNorm, ticker: histTicker },
  );
  let extra = 0;
  if (Math.abs(anchor.priceChangePct - hist.priceChangePct) <= 1.5) extra += 10;
  else if (Math.abs(anchor.priceChangePct - hist.priceChangePct) <= 3) extra += 5;
  if (anchor.trend === hist.trend) extra += 10;
  return Math.min(100, Math.round((dna + extra) * 10) / 10);
}

function outcomesAtIndex(bars: Bar[], i: number): { o5: number; o10: number } | null {
  if (i + 10 >= bars.length) return null;
  const e = bars[i].c;
  if (e <= 0) return null;
  const o5 = ((bars[i + 5].c - e) / e) * 100;
  const o10 = ((bars[i + 10].c - e) / e) * 100;
  return {
    o5: Number(o5.toFixed(4)),
    o10: Number(o10.toFixed(4)),
  };
}

async function loadQuotesRange(symbol: string, from: Date, to: Date): Promise<Bar[]> {
  const rows = await prisma.quote.findMany({
    where: {
      symbol: symbol.toUpperCase(),
      timestamp: { gte: from, lte: to },
    },
    orderBy: { timestamp: "asc" },
  });
  return collapseToDailySorted(rows);
}

async function resolveAnchorDay(symbol: string, dateInput?: string): Promise<{ bars: Bar[]; anchorIndex: number }> {
  const sym = symbol.toUpperCase();
  const end = dateInput ? parseIsoDateUtc(dateInput) : new Date();
  const from = new Date(end);
  from.setUTCDate(from.getUTCDate() - 400);
  const bars = await loadQuotesRange(sym, from, end);
  if (bars.length < 35) {
    throw new Error(`Not enough quote history for ${sym}`);
  }
  let anchorIndex = bars.length - 1;
  if (dateInput) {
    const target = dayKey(parseIsoDateUtc(dateInput));
    const idx = bars.findIndex((b) => dayKey(b.t) === target);
    if (idx < 0) {
      let best = -1;
      for (let i = bars.length - 1; i >= 0; i--) {
        if (dayKey(bars[i].t) <= target) {
          best = i;
          break;
        }
      }
      if (best < 0) throw new Error(`No quotes on or before ${dateInput} for ${sym}`);
      anchorIndex = best;
    } else anchorIndex = idx;
  }
  if (anchorIndex < 30) throw new Error("Not enough history before anchor date");
  return { bars, anchorIndex };
}

async function listOtherSymbols(exclude: string, limit: number): Promise<string[]> {
  const rows = await prisma.quote.findMany({
    where: { symbol: { not: exclude.toUpperCase() } },
    distinct: ["symbol"],
    select: { symbol: true },
    orderBy: { symbol: "asc" },
    take: limit,
  });
  return rows.map((r) => r.symbol);
}

export async function findSimilarHistoricalSetups(
  symbol: string,
  date?: string,
): Promise<ReverseScreenerFindResponse> {
  const symU = symbol.trim().toUpperCase();
  if (!symU) throw new Error("Missing symbol");

  const { bars: anchorBars, anchorIndex } = await resolveAnchorDay(symU, date);
  const anchorFeat = buildFeaturesAtIndex(anchorBars, anchorIndex);
  if (!anchorFeat) throw new Error("Could not compute setup features for anchor date");

  const currentSetup: ReverseScreenerCurrentSetup = {
    rsi: Number(anchorFeat.rsi.toFixed(2)),
    volume: Number(anchorFeat.volumeRatio.toFixed(4)),
    priceChange: Number(anchorFeat.priceChangePct.toFixed(4)),
    trend: anchorFeat.trend,
  };

  const anchorDay = anchorBars[anchorIndex].t;
  const windowStart = new Date(anchorDay);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 2);
  const windowEnd = new Date(anchorDay);
  windowEnd.setUTCDate(windowEnd.getUTCDate() - 1);

  const otherSymbols = await listOtherSymbols(symU, 100);
  const pool: ReverseScreenerMatch[] = [];

  const extBefore = new Date(windowStart);
  extBefore.setUTCDate(extBefore.getUTCDate() - 60);
  const extAfter = new Date(windowEnd);
  extAfter.setUTCDate(extAfter.getUTCDate() + 15);

  for (const other of otherSymbols) {
    const bars = await loadQuotesRange(other, extBefore, extAfter);
    if (bars.length < 45) continue;

    for (let i = 30; i < bars.length - 10; i++) {
      const d = bars[i].t;
      if (d.getTime() < windowStart.getTime() || d.getTime() > windowEnd.getTime()) continue;
      const f = buildFeaturesAtIndex(bars, i);
      if (!f) continue;
      const oc = outcomesAtIndex(bars, i);
      if (!oc) continue;
      const similarity = reverseSetupSimilarity(anchorFeat, f, symU, other);
      pool.push({
        symbol: other,
        date: dayKey(bars[i].t),
        similarity,
        outcome5d: oc.o5,
        outcome10d: oc.o10,
      });
    }
  }

  pool.sort((a, b) => b.similarity - a.similarity);
  const seen = new Set<string>();
  const matches: ReverseScreenerMatch[] = [];
  for (const m of pool) {
    const key = `${m.symbol}|${m.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(m);
    if (matches.length >= 5) break;
  }

  const avgOutcome =
    matches.length === 0
      ? 0
      : Number(
          (
            matches.reduce((acc, m) => acc + (m.outcome5d + m.outcome10d) / 2, 0) / matches.length
          ).toFixed(4),
        );

  return { currentSetup, matches, avgOutcome };
}
