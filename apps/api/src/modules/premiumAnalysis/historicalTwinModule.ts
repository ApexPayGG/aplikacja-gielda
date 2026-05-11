import type { PrismaClient } from "@prisma/client";

export type StockSetupLike = {
  ticker: string;
  snapshotDate?: string;
  pe: number;
  peVsSector: number;
  peVsHistory: number;
  revenueGrowth3Y: number;
  earningsGrowth3Y: number;
  growthDecelerating: boolean;
  marginTrend3Y: "expanding" | "stable" | "compressing";
  analystBuyPct: number;
  shortInterest: number;
  rateEnvironment: "rising" | "flat" | "falling";
  sectorMomentum: number;
  marketBreadth: number;
};

type TwinStats = {
  bullish_outcomes: number;
  flat_outcomes: number;
  bearish_outcomes: number;
  avg_5y_return: number;
};

type HistoricalFallback = {
  fallback: true;
  reason: "insufficient_historical_data";
};

type CurrentTwinFeatures = {
  priceClose: number;
  priceChange5d: number;
  priceChange20d: number;
  volumeRatio: number;
  rsi14: number;
  pe: number;
  peVsSector: number;
  revenueGrowth3Y: number;
  earningsGrowth3Y: number;
};

type SimilarSetupRow = {
  symbol: string;
  snapshot_date: Date;
  price_close: number | null;
  price_change_5d: number | null;
  outcome_5d: number | null;
  outcome_20d: number | null;
  similarity: number;
};

type SimilarSetupsResult = {
  rows: SimilarSetupRow[];
  fallback?: HistoricalFallback;
};

type HistoricalTwinResult = {
  currentSetup: StockSetupLike;
  twins: Array<{
    ticker: string;
    date_of_match: string;
    match_score: number;
    common_attributes: Array<{ dimension: string; current: string | number | boolean; twin: string | number | boolean }>;
    outcome_5y: {
      total_return_pct: number;
      max_drawdown_pct: number;
      volatility_annualized: number;
      notable_events: string[];
    };
    lesson: string;
  }>;
  statistics: TwinStats;
  fallback?: HistoricalFallback;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -100, 100);
}

function scaleAround(value: number, center: number, span: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp((value - center) / span, -1, 1);
}

function normalizeToEmbedding(features: CurrentTwinFeatures): number[] {
  return [
    scaleAround(features.priceClose, 150, 200),
    scaleAround(features.priceChange5d, 0, 20),
    scaleAround(features.priceChange20d, 0, 35),
    scaleAround(features.volumeRatio, 1, 1.5),
    scaleAround(features.rsi14, 50, 50),
    scaleAround(features.pe, 20, 25),
    scaleAround(features.peVsSector, 1, 1),
    scaleAround(features.revenueGrowth3Y, 0, 60),
    scaleAround(features.earningsGrowth3Y, 0, 60),
  ].map((value) => Number(value.toFixed(6)));
}

async function getLatestQuoteBySymbol(prisma: PrismaClient, symbols: string[]): Promise<Map<string, number>> {
  if (symbols.length === 0) return new Map();
  const rows = await prisma.quote.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { timestamp: "desc" },
    take: symbols.length * 4,
    select: { symbol: true, close: true },
  });
  const out = new Map<string, number>();
  for (const row of rows) {
    if (!out.has(row.symbol)) out.set(row.symbol, Number(row.close));
  }
  return out;
}

export async function buildCurrentSetup(prisma: PrismaClient, ticker: string): Promise<StockSetupLike | null> {
  const symbol = ticker.toUpperCase();
  const [company, fundamentals, latestRsi] = await Promise.all([
    prisma.company.findUnique({ where: { symbol } }),
    prisma.fundamental.findMany({
      where: {
        symbol,
        metric: {
          in: ["eps_ttm", "revenue", "eps", "fcf", "net_debt_to_ebitda"],
        },
      },
      orderBy: [{ metric: "asc" }, { year: "desc" }],
    }),
    prisma.technicalIndicator.findFirst({
      where: { symbol, indicator: "RSI" },
      orderBy: { timestamp: "desc" },
      select: { value: true },
    }),
  ]);
  if (!company) return null;

  const metricMap = new Map<string, number[]>();
  for (const row of fundamentals) {
    const list = metricMap.get(row.metric) ?? [];
    list.push(Number(row.value));
    metricMap.set(row.metric, list);
  }
  const epsTtm = metricMap.get("eps_ttm")?.[0] ?? 3;

  const peers = company.sector
    ? await prisma.company.findMany({
        where: { sector: company.sector },
        take: 20,
        select: { symbol: true },
      })
    : [];
  const peerSymbols = peers.map((p) => p.symbol).filter((s) => s !== symbol);
  const peerQuotes = await getLatestQuoteBySymbol(prisma, peerSymbols);
  const peerFundamentals = await prisma.fundamental.findMany({
    where: { symbol: { in: peerSymbols }, metric: "eps_ttm", year: 0 },
    select: { symbol: true, value: true },
  });
  const peerPEs = peerFundamentals
    .map((row) => {
      const px = peerQuotes.get(row.symbol);
      const eps = Number(row.value);
      return px != null && eps > 0 ? px / eps : null;
    })
    .filter((n): n is number => n != null && Number.isFinite(n));

  const latestQuote = await prisma.quote.findFirst({
    where: { symbol },
    orderBy: { timestamp: "desc" },
    select: { close: true },
  });
  const price = latestQuote ? Number(latestQuote.close) : 100;
  const pe = epsTtm > 0 ? price / epsTtm : 25;
  const peVsSector =
    peerPEs.length > 0 ? pe / (peerPEs.reduce((a, b) => a + b, 0) / peerPEs.length) : 1.05;

  const revenueSeries = metricMap.get("revenue") ?? [];
  const epsSeries = metricMap.get("eps") ?? [];
  const revGrowth3Y =
    revenueSeries.length >= 4 && revenueSeries[3] !== 0
      ? ((revenueSeries[0] - revenueSeries[3]) / Math.abs(revenueSeries[3])) * 100
      : 10;
  const epsGrowth3Y =
    epsSeries.length >= 4 && epsSeries[3] !== 0
      ? ((epsSeries[0] - epsSeries[3]) / Math.abs(epsSeries[3])) * 100
      : 8;
  const growthDecelerating = revGrowth3Y < 5 || epsGrowth3Y < 5;
  const marginTrend3Y: "expanding" | "stable" | "compressing" =
    revGrowth3Y > 12 ? "expanding" : revGrowth3Y < 2 ? "compressing" : "stable";
  const analystBuyPct = Math.min(90, Math.max(20, 50 + ((latestRsi ? Number(latestRsi.value) : 50) - 50) * 0.5));

  return {
    ticker: symbol,
    pe,
    peVsSector,
    peVsHistory: 1,
    revenueGrowth3Y: revGrowth3Y,
    earningsGrowth3Y: epsGrowth3Y,
    growthDecelerating,
    marginTrend3Y,
    analystBuyPct,
    shortInterest: 5,
    rateEnvironment: "flat",
    sectorMomentum: 8,
    marketBreadth: 4,
  };
}

async function computeCurrentFeatures(symbol: string, prisma: PrismaClient): Promise<CurrentTwinFeatures | null> {
  const upper = symbol.toUpperCase();
  const [setup, latestRsi, quotes] = await Promise.all([
    buildCurrentSetup(prisma, upper),
    prisma.technicalIndicator.findFirst({
      where: { symbol: upper, indicator: "RSI" },
      orderBy: { timestamp: "desc" },
      select: { value: true },
    }),
    prisma.quote.findMany({
      where: { symbol: upper },
      orderBy: { timestamp: "desc" },
      take: 30,
      select: { close: true, volume: true },
    }),
  ]);
  if (!setup || quotes.length === 0) return null;

  const closeNow = Number(quotes[0].close);
  const close5 = quotes[5] ? Number(quotes[5].close) : closeNow;
  const close20 = quotes[20] ? Number(quotes[20].close) : closeNow;
  const priceChange5d = close5 > 0 ? ((closeNow - close5) / close5) * 100 : 0;
  const priceChange20d = close20 > 0 ? ((closeNow - close20) / close20) * 100 : 0;

  const latestVolume = Number(quotes[0].volume ?? 0);
  const trailing = quotes.slice(1, 21).map((row) => Number(row.volume ?? 0)).filter((v) => v > 0);
  const volumeAvg = trailing.length > 0 ? trailing.reduce((acc, value) => acc + value, 0) / trailing.length : latestVolume;
  const volumeRatio = volumeAvg > 0 ? latestVolume / volumeAvg : 1;
  const rsi14 = latestRsi ? Number(latestRsi.value) : 50;

  return {
    priceClose: closeNow,
    priceChange5d: safePercent(priceChange5d),
    priceChange20d: safePercent(priceChange20d),
    volumeRatio: clamp(volumeRatio, 0, 5),
    rsi14: clamp(rsi14, 0, 100),
    pe: setup.pe,
    peVsSector: setup.peVsSector,
    revenueGrowth3Y: safePercent(setup.revenueGrowth3Y),
    earningsGrowth3Y: safePercent(setup.earningsGrowth3Y),
  };
}

async function findSimilarSetups(symbol: string, prisma: PrismaClient, limit = 10): Promise<SimilarSetupsResult> {
  const current = await computeCurrentFeatures(symbol, prisma);
  if (!current) {
    return { rows: [] };
  }

  const embedding = normalizeToEmbedding(current);
  const vectorStr = `[${embedding.join(",")}]`;
  const safeSymbol = symbol.toUpperCase().replace(/'/g, "''");

  const results = await prisma.$queryRawUnsafe<SimilarSetupRow[]>(`
    SELECT
      symbol,
      snapshot_date,
      price_close,
      price_change_5d,
      outcome_5d,
      outcome_20d,
      1 - (embedding <=> '${vectorStr}'::vector) as similarity
    FROM stock_setups_history
    WHERE symbol != '${safeSymbol}'
      AND outcome_5d IS NOT NULL
      AND snapshot_date < NOW() - INTERVAL '30 days'
    ORDER BY embedding <=> '${vectorStr}'::vector
    LIMIT ${Math.max(1, limit)}
  `);

  if (results.length === 0) {
    return {
      rows: [],
      fallback: { fallback: true, reason: "insufficient_historical_data" },
    };
  }

  return { rows: results };
}

export async function findHistoricalTwins(
  prisma: PrismaClient,
  ticker: string,
  limit = 3,
  minMatch = 60,
): Promise<HistoricalTwinResult> {
  const symbol = ticker.toUpperCase();
  const currentSetup = await buildCurrentSetup(prisma, symbol);
  if (!currentSetup) throw new Error("Ticker not found");

  const similar = await findSimilarSetups(symbol, prisma, Math.min(10, Math.max(1, limit)));
  if (similar.rows.length === 0) {
    return {
      currentSetup,
      twins: [],
      statistics: {
        bullish_outcomes: 0,
        flat_outcomes: 0,
        bearish_outcomes: 0,
        avg_5y_return: 0,
      },
      ...(similar.fallback ? { fallback: similar.fallback } : {}),
    };
  }

  const twins = similar.rows
    .map((row) => {
      const score = round2(clamp(row.similarity, 0, 1) * 100);
      return {
        ticker: row.symbol,
        date_of_match: `${row.snapshot_date.getUTCFullYear()}-Q${Math.floor(row.snapshot_date.getUTCMonth() / 3) + 1}`,
        match_score: score,
        common_attributes: [
          { dimension: "pe", current: round2(currentSetup.pe), twin: "n/a" },
          { dimension: "price_change_5d", current: "current_embedding", twin: round2(Number(row.price_change_5d ?? 0)) },
        ],
        outcome_5y: {
          total_return_pct: round2(Number(row.outcome_20d ?? row.outcome_5d ?? 0)),
          max_drawdown_pct: 0,
          volatility_annualized: 0,
          notable_events: ["Cosine similarity match from historical setup embedding"],
        },
        lesson: "Historical analogue selected by vector cosine similarity.",
      };
    })
    .filter((row) => row.match_score >= minMatch)
    .slice(0, limit);

  const stats: TwinStats = {
    bullish_outcomes: twins.filter((t) => t.outcome_5y.total_return_pct > 10).length,
    flat_outcomes: twins.filter((t) => t.outcome_5y.total_return_pct >= -5 && t.outcome_5y.total_return_pct <= 10).length,
    bearish_outcomes: twins.filter((t) => t.outcome_5y.total_return_pct < -5).length,
    avg_5y_return:
      twins.length > 0
        ? round2(twins.reduce((acc, row) => acc + row.outcome_5y.total_return_pct, 0) / twins.length)
        : 0,
  };

  return {
    currentSetup,
    twins,
    statistics: stats,
    ...(similar.fallback ? { fallback: similar.fallback } : {}),
  };
}
