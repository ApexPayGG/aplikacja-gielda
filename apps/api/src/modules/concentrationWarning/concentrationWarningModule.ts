import type { PrismaClient } from "@prisma/client";

export type StockWeightRow = {
  ticker: string;
  sector: string;
  value: number;
  weight: number;
};

export type SectorWeightRow = {
  sector: string;
  value: number;
  weight: number;
};

export type ConcentrationWarning = {
  type: "SINGLE_STOCK" | "SINGLE_SECTOR" | "TOP_HEAVY";
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  ticker?: string;
  sector?: string;
  weight?: number;
  top3Share?: number;
};

export type ConcentrationAnalysisResult = {
  totalValue: number;
  positionCount: number;
  stockWeights: StockWeightRow[];
  sectorWeights: SectorWeightRow[];
  warnings: ConcentrationWarning[];
  diversificationScore: number;
};

const MAX_SINGLE_STOCK = 20;
const MAX_SINGLE_SECTOR = 40;
const TOP3_THRESHOLD = 60;

function toNum(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function severityForStock(weight: number): "HIGH" | "MEDIUM" {
  return weight > 30 ? "HIGH" : "MEDIUM";
}

function severityForSector(weight: number): "HIGH" | "MEDIUM" {
  return weight > 55 ? "HIGH" : "MEDIUM";
}

function severityForTop3(share: number): "HIGH" | "MEDIUM" {
  return share > 75 ? "HIGH" : "MEDIUM";
}

function diversificationScore(params: {
  maxStockWeight: number;
  maxSectorWeight: number;
  top3Share: number;
  hasPositions: boolean;
}): number {
  if (!params.hasPositions) return 100;
  let penalty = 0;
  if (params.maxStockWeight > MAX_SINGLE_STOCK) {
    penalty += Math.min(40, (params.maxStockWeight - MAX_SINGLE_STOCK) * 1.2);
  }
  if (params.maxSectorWeight > MAX_SINGLE_SECTOR) {
    penalty += Math.min(35, (params.maxSectorWeight - MAX_SINGLE_SECTOR) * 0.9);
  }
  if (params.top3Share > TOP3_THRESHOLD) {
    penalty += Math.min(30, (params.top3Share - TOP3_THRESHOLD) * 0.75);
  }
  return Math.round(Math.max(0, Math.min(100, 100 - penalty)));
}

/**
 * Open paper positions: notional value = quantity × latest quote close (fallback entry).
 * Sector from `companies`; unknown tickers → sector "Unknown".
 */
export async function analyzeConcentration(
  prisma: PrismaClient,
  userId: string,
): Promise<ConcentrationAnalysisResult> {
  const rows = await prisma.paperTrade.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { entryAt: "desc" },
  });

  const tickerMap = new Map<string, { value: number; sector: string }>();

  for (const row of rows) {
    const ticker = String(row.ticker).toUpperCase();
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

    const value = quantity * currentPrice;
    const company = await prisma.company.findUnique({ where: { symbol: ticker } });
    const sector = company?.sector?.trim() ? String(company.sector) : "Unknown";

    const prev = tickerMap.get(ticker);
    tickerMap.set(ticker, {
      value: (prev?.value ?? 0) + value,
      sector: prev?.sector && prev.sector !== "Unknown" ? prev.sector : sector,
    });
  }

  const stockWeights: StockWeightRow[] = [...tickerMap.entries()]
    .map(([ticker, { value, sector }]) => ({
      ticker,
      sector,
      value: Number(value.toFixed(2)),
      weight: 0,
    }))
    .sort((a, b) => b.value - a.value);

  const totalValue = stockWeights.reduce((s, r) => s + r.value, 0);
  if (totalValue <= 0) {
    return {
      totalValue: 0,
      positionCount: rows.length,
      stockWeights: [],
      sectorWeights: [],
      warnings: [],
      diversificationScore: 100,
    };
  }

  for (const r of stockWeights) {
    r.weight = Number(((r.value / totalValue) * 100).toFixed(2));
  }

  const sectorMap = new Map<string, number>();
  for (const r of stockWeights) {
    sectorMap.set(r.sector, (sectorMap.get(r.sector) ?? 0) + r.value);
  }

  const sectorWeights: SectorWeightRow[] = [...sectorMap.entries()]
    .map(([sector, value]) => ({
      sector,
      value: Number(value.toFixed(2)),
      weight: Number(((value / totalValue) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.weight - a.weight);

  const warnings: ConcentrationWarning[] = [];
  const maxStockWeight = Math.max(...stockWeights.map((s) => s.weight), 0);
  const maxSectorWeight = Math.max(...sectorWeights.map((s) => s.weight), 0);

  const sortedByWeight = [...stockWeights].sort((a, b) => b.weight - a.weight);
  const top3Share = sortedByWeight.slice(0, 3).reduce((s, r) => s + r.weight, 0);

  for (const s of stockWeights) {
    if (s.weight > MAX_SINGLE_STOCK) {
      warnings.push({
        type: "SINGLE_STOCK",
        severity: severityForStock(s.weight),
        ticker: s.ticker,
        weight: s.weight,
        message: `${s.ticker} is ${s.weight}% of portfolio (recommended max ${MAX_SINGLE_STOCK}%).`,
      });
    }
  }

  for (const sec of sectorWeights) {
    if (sec.weight > MAX_SINGLE_SECTOR) {
      warnings.push({
        type: "SINGLE_SECTOR",
        severity: severityForSector(sec.weight),
        sector: sec.sector,
        weight: sec.weight,
        message: `Sector ${sec.sector} is ${sec.weight}% of portfolio (recommended max ${MAX_SINGLE_SECTOR}%).`,
      });
    }
  }

  if (top3Share > TOP3_THRESHOLD && stockWeights.length >= 3) {
    warnings.push({
      type: "TOP_HEAVY",
      severity: severityForTop3(top3Share),
      top3Share,
      message: `Top 3 holdings represent ${Number(top3Share.toFixed(2))}% of portfolio.`,
    });
  }

  const score = diversificationScore({
    maxStockWeight,
    maxSectorWeight,
    top3Share,
    hasPositions: stockWeights.length > 0,
  });

  return {
    totalValue: Number(totalValue.toFixed(2)),
    positionCount: rows.length,
    stockWeights,
    sectorWeights,
    warnings,
    diversificationScore: score,
  };
}
