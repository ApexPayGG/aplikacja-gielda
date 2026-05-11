import "../src/load-env";
import process from "node:process";
import { PrismaClient, Prisma } from "@prisma/client";
import { buildCurrentSetup } from "../src/modules/premiumAnalysis/historicalTwinModule";

const prisma = new PrismaClient();

function parseSymbolsFromEnv(): string[] | null {
  const raw = process.env.PREMIUM_TWINS_SYMBOLS?.trim();
  if (!raw) return null;
  return raw
    .split(/[\s,;]+/)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function quarterDatesBack(count: number): Date[] {
  const now = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 1, 0, 0, 0, 0));
    dates.push(d);
  }
  return dates;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function buildRowsForTicker(ticker: string, snapshots: Date[]) {
  const base = await buildCurrentSetup(prisma, ticker);
  if (!base) return [];
  const rng = mulberry32(hashString(ticker));
  return snapshots.map((snapshotDate, idx) => {
    const drift = 1 + (rng() - 0.5) * 0.16 - idx * 0.012;
    const growthNoise = (rng() - 0.5) * 5;
    const drawdown = -Math.abs((rng() * 45 + idx * 3) % 65);
    return {
      ticker,
      snapshotDate,
      pe: round2(base.pe * drift),
      peVsSector: round2(base.peVsSector * (0.9 + rng() * 0.2)),
      peVsHistory: round2(base.peVsHistory * (0.88 + rng() * 0.25)),
      ps: round2(4 + rng() * 9),
      evEbitda: round2(8 + rng() * 14),
      revenueGrowth3Y: round2(base.revenueGrowth3Y + growthNoise),
      earningsGrowth3Y: round2(base.earningsGrowth3Y + growthNoise * 0.8),
      growthDecelerating: base.growthDecelerating ? rng() > 0.3 : rng() > 0.75,
      netDebtToEbitda: round2(Math.max(0, 0.4 + rng() * 3)),
      fcfYield: round2(1 + rng() * 6),
      marginTrend3Y: rng() > 0.6 ? "expanding" : rng() < 0.25 ? "compressing" : "stable",
      marketCapRankInSector: Math.floor(1 + rng() * 12),
      marketShareTrend: rng() > 0.55 ? "gaining" : rng() < 0.3 ? "losing" : "stable",
      analystBuyPct: round2(Math.max(10, Math.min(90, base.analystBuyPct + (rng() - 0.5) * 20))),
      retailOwnershipPct: round2(8 + rng() * 42),
      shortInterest: round2(Math.max(0.2, base.shortInterest + (rng() - 0.5) * 6)),
      rateEnvironment: rng() > 0.62 ? "rising" : rng() < 0.25 ? "falling" : "flat",
      sectorMomentum: round2(-20 + rng() * 40),
      marketBreadth: round2(-15 + rng() * 30),
      outcome5yReturn: round2(-65 + rng() * 320),
      outcomeMaxDrawdown: round2(drawdown),
      outcomeVolatility: round2(14 + rng() * 36),
      notableEvents: [
        rng() > 0.55 ? "Margin cycle shift" : "Multiple compression",
        rng() > 0.4 ? "Product transition" : "Rate regime shock",
      ] as Prisma.JsonArray,
    };
  });
}

async function main() {
  const explicit = parseSymbolsFromEnv();
  const symbols =
    explicit ??
    (
      await prisma.company.findMany({
        select: { symbol: true },
        orderBy: { marketCap: "desc" },
        take: 60,
      })
    ).map((row) => row.symbol.toUpperCase());
  const snapshots = quarterDatesBack(24);
  let upserts = 0;
  for (const ticker of symbols) {
    const rows = await buildRowsForTicker(ticker, snapshots);
    for (const row of rows) {
      await prisma.stockSetupHistory.upsert({
        where: { ticker_snapshotDate: { ticker: row.ticker, snapshotDate: row.snapshotDate } },
        update: row,
        create: row,
      });
      upserts += 1;
    }
  }
  console.log(`[stock-setups] symbols=${symbols.length} snapshots=${snapshots.length} upserts=${upserts}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
