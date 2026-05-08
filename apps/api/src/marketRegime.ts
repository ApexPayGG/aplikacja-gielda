import { prisma } from "./db/index";
import { getCacheRedis } from "./redis";

type RegimeName = "TRENDING" | "RANGING" | "RISK_ON" | "RISK_OFF";

export type MarketRegime = {
  regime: RegimeName;
  confidence: number;
  description: string;
  weights: { momentum: number; mean_reversion: number; breakout: number };
};

type Bar = {
  close: number;
  high: number;
  low: number;
  volume: number;
};

const REGIME_TTL_SECONDS = 300;
const MARKET_PROXY_SYMBOL = "SPY";

const REGIME_WEIGHTS: Record<RegimeName, MarketRegime["weights"]> = {
  TRENDING: { momentum: 1.3, mean_reversion: 0.6, breakout: 1.1 },
  RANGING: { momentum: 0.7, mean_reversion: 1.4, breakout: 0.8 },
  RISK_ON: { momentum: 1.2, mean_reversion: 0.9, breakout: 1.0 },
  RISK_OFF: { momentum: 0.8, mean_reversion: 1.2, breakout: 0.6 },
};

const DEFAULT_REGIME: MarketRegime = {
  regime: "RANGING",
  confidence: 25,
  description: "Insufficient market data; fallback regime assumes balanced/ranging conditions.",
  weights: REGIME_WEIGHTS.RANGING,
};

function cacheKey(symbol: string): string {
  return `market_regime:${symbol.trim().toUpperCase()}`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function toBar(row: {
  close: unknown;
  high: unknown;
  low: unknown;
  volume: bigint;
}): Bar {
  return {
    close: Number(row.close),
    high: Number(row.high),
    low: Number(row.low),
    volume: Number(row.volume),
  };
}

function buildTrueRanges(barsDesc: Bar[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < barsDesc.length - 1; i += 1) {
    const current = barsDesc[i];
    const prevClose = barsDesc[i + 1].close;
    const range = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
    tr.push(range);
  }
  return tr;
}

function pctChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return (current - previous) / previous;
}

function pickBestRegime(scores: Record<RegimeName, number>): RegimeName {
  const order: RegimeName[] = ["RISK_OFF", "RISK_ON", "TRENDING", "RANGING"];
  let best: RegimeName = "RANGING";
  let bestScore = -1;
  for (const regime of order) {
    if (scores[regime] > bestScore) {
      best = regime;
      bestScore = scores[regime];
    }
  }
  return best;
}

async function readCache(symbol: string): Promise<MarketRegime | null> {
  try {
    const redis = getCacheRedis();
    const raw = await redis.get(cacheKey(symbol));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarketRegime>;
    if (!parsed.regime || !parsed.weights || typeof parsed.confidence !== "number") return null;
    return {
      regime: parsed.regime,
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
      description: String(parsed.description ?? ""),
      weights: parsed.weights,
    };
  } catch {
    return null;
  }
}

async function writeCache(symbol: string, value: MarketRegime): Promise<void> {
  try {
    const redis = getCacheRedis();
    await redis.set(cacheKey(symbol), JSON.stringify(value), "EX", REGIME_TTL_SECONDS);
  } catch {
    // intentionally ignore cache failures
  }
}

async function loadBars(symbol: string, take: number): Promise<Bar[]> {
  const rows = await prisma.quote.findMany({
    where: { symbol: symbol.toUpperCase() },
    orderBy: { timestamp: "desc" },
    take,
  });
  return rows.map(toBar);
}

export async function getMarketRegime(symbol: string): Promise<MarketRegime> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return DEFAULT_REGIME;

  const cached = await readCache(normalized);
  if (cached) return cached;

  const lastData = await prisma.quote.findFirst({
    where: { symbol: normalized },
    orderBy: { timestamp: "desc" },
  });
  if (!lastData) {
    await writeCache(normalized, DEFAULT_REGIME);
    return DEFAULT_REGIME;
  }

  const [bars, marketBars] = await Promise.all([loadBars(normalized, 60), loadBars(MARKET_PROXY_SYMBOL, 10)]);
  if (bars.length < 30) {
    await writeCache(normalized, DEFAULT_REGIME);
    return DEFAULT_REGIME;
  }

  const closes20 = bars.slice(0, 20).map((bar) => bar.close);
  const ma20 = avg(closes20);
  const bbStd = stdDev(closes20);
  const bbUpper = ma20 + 2 * bbStd;
  const bbLower = ma20 - 2 * bbStd;
  const latestClose = bars[0].close;

  const tr = buildTrueRanges(bars);
  const atrCurrent = avg(tr.slice(0, 14));
  const atrAvg30 = avg(tr.slice(0, 30));
  const atrPct = latestClose > 0 ? atrCurrent / latestClose : 0;
  const atrPctAvg30 = ma20 > 0 ? atrAvg30 / ma20 : 0;

  const volumeCurrent = bars[0].volume;
  const volumeAvg30 = avg(bars.slice(0, 30).map((bar) => bar.volume));

  const symbolReturn5 = bars.length > 5 ? pctChange(bars[0].close, bars[5].close) : 0;
  const marketGreen = marketBars.length > 1 ? marketBars[0].close > marketBars[1].close : false;
  const marketReturn5 = marketBars.length > 5 ? pctChange(marketBars[0].close, marketBars[5].close) : 0;

  const priceAboveMA20 = latestClose > ma20;
  const atrAboveAverage = atrCurrent > atrAvg30;
  const atrBelowAverage = atrCurrent < atrAvg30;
  const volumeAboveAverage = volumeCurrent > volumeAvg30;
  const volumeNormal = volumeCurrent >= volumeAvg30 * 0.85 && volumeCurrent <= volumeAvg30 * 1.2;
  const lowVolume = volumeCurrent < volumeAvg30 * 0.85;
  const inBollingerRange = latestClose >= bbLower && latestClose <= bbUpper;
  const lowVolatility = atrPct < Math.max(0.02, atrPctAvg30 * 0.9);
  const volatilitySpike = atrPct > Math.max(0.03, atrPctAvg30 * 1.2);
  const sectorDivergenceProxy = Math.abs(symbolReturn5 - marketReturn5) > 0.03;

  const scores: Record<RegimeName, number> = {
    TRENDING: [priceAboveMA20, atrAboveAverage, volumeAboveAverage, latestClose >= bbUpper * 0.98].filter(Boolean)
      .length,
    RANGING: [inBollingerRange, atrBelowAverage, Math.abs(latestClose - ma20) / ma20 < 0.015, !volumeAboveAverage].filter(
      Boolean,
    ).length,
    RISK_ON: [lowVolatility, marketGreen, volumeNormal, !sectorDivergenceProxy].filter(Boolean).length,
    RISK_OFF: [volatilitySpike, !marketGreen, sectorDivergenceProxy, lowVolume].filter(Boolean).length,
  };

  const regime = pickBestRegime(scores);
  const confidence = Math.max(25, Math.min(100, scores[regime] * 25));
  const description =
    regime === "TRENDING"
      ? "Price is above MA20 with elevated ATR and volume, favoring momentum continuation and breakouts."
      : regime === "RANGING"
        ? "Price remains inside Bollinger bands with calmer ATR, favoring mean-reversion setups."
        : regime === "RISK_ON"
          ? "Volatility is contained and broad market tone is constructive, supporting directional risk-taking."
          : "Volatility/dispersion signals defensive conditions; reduce breakout aggression and protect downside.";

  const output: MarketRegime = {
    regime,
    confidence,
    description,
    weights: REGIME_WEIGHTS[regime],
  };
  await writeCache(normalized, output);
  return output;
}

export function startMarketRegimeCache(
  symbols: string[] = [MARKET_PROXY_SYMBOL],
  intervalMs: number = REGIME_TTL_SECONDS * 1000,
): { stop: () => void } {
  const normalizedSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];

  const warm = async (): Promise<void> => {
    await Promise.allSettled(normalizedSymbols.map((symbol) => getMarketRegime(symbol)));
  };

  void warm();
  const timer = setInterval(() => {
    void warm();
  }, Math.max(60_000, intervalMs));

  return {
    stop: () => clearInterval(timer),
  };
}
