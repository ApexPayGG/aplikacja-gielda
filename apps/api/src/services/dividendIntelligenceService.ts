import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { prisma } from "../db/index";

export interface DividendIntelligenceResponse {
  symbol: string;
  safetyScore: number;
  trendDirection: string;
  sectorPercentile: number;
  safetyReason: string;
}

export interface DividendAlertListItem {
  alertType: string;
  severity: number;
  message: string;
  createdAt: string;
}

export interface DividendAlertsResponse {
  symbol: string;
  alerts: DividendAlertListItem[];
}

/** Średni safety score per sektor (klucz = nazwa sektora z Company). */
export type SectorDividendComparisonResponse = Record<string, number>;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export async function getDividendIntelligence(symbol: string): Promise<DividendIntelligenceResponse | null> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return null;

  const cacheKey = redisKeys.intelligenceDividend(sym);
  const cached = await cacheJsonGet<DividendIntelligenceResponse>(cacheKey);
  if (cached?.symbol && typeof cached.safetyScore === "number") {
    return cached;
  }

  const row = await prisma.dividendIntelligence.findUnique({
    where: { symbol: sym },
    select: {
      symbol: true,
      safetyScore: true,
      safetyReason: true,
      trendDirection: true,
      sectorPercentile: true,
    },
  });

  if (!row) return null;

  const payload: DividendIntelligenceResponse = {
    symbol: row.symbol,
    safetyScore: row.safetyScore,
    trendDirection: row.trendDirection,
    sectorPercentile: row.sectorPercentile,
    safetyReason: row.safetyReason,
  };

  await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.INTELLIGENCE_DIVIDEND);
  return payload;
}

export async function getRecentAlerts(symbol: string, limit = 20): Promise<DividendAlertsResponse> {
  const sym = normalizeSymbol(symbol);
  const take = Math.min(20, Math.max(1, limit));

  const cacheKey = redisKeys.alertsDividend(sym);
  if (take === 20) {
    const cached = await cacheJsonGet<DividendAlertsResponse>(cacheKey);
    if (cached?.symbol === sym && Array.isArray(cached.alerts)) {
      return cached;
    }
  }

  const rows = await prisma.dividendAlert.findMany({
    where: { symbol: sym },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      alertType: true,
      severity: true,
      message: true,
      createdAt: true,
    },
  });

  const alerts: DividendAlertListItem[] = rows.map((r) => ({
    alertType: r.alertType,
    severity: r.severity,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));

  const payload: DividendAlertsResponse = { symbol: sym, alerts };
  if (take === 20) {
    await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.ALERTS_DIVIDEND);
  }
  return payload;
}

export async function getSectorComparison(): Promise<SectorDividendComparisonResponse> {
  const cacheKey = redisKeys.sectorDividendComparison();
  const cached = await cacheJsonGet<SectorDividendComparisonResponse>(cacheKey);
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
    return cached;
  }

  const rows = await prisma.dividendIntelligence.findMany({
    select: {
      safetyScore: true,
      company: { select: { sector: true } },
    },
  });

  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const sector = r.company.sector;
    const prev = sums.get(sector) ?? { sum: 0, n: 0 };
    prev.sum += r.safetyScore;
    prev.n += 1;
    sums.set(sector, prev);
  }

  const out: SectorDividendComparisonResponse = {};
  for (const [sector, { sum, n }] of sums) {
    if (n > 0) {
      out[sector] = Math.round((sum / n) * 100) / 100;
    }
  }

  await cacheJsonSet(cacheKey, out, REDIS_TTL_SEC.SECTOR_DIVIDEND_COMPARISON);
  return out;
}
