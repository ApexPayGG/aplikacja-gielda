/**
 * Seed: spółki + opcjonalnie mock dywidend (wyłącz gdy używasz EODHD — patrz DIVIDEND_SEED_MOCK).
 * Uruchom: npm run db:seed (z katalogu apps/api)
 */
import "dotenv/config";
import { PrismaClient, DividendAlertType, DividendTrendDirection } from "@prisma/client";

const prisma = new PrismaClient();

/** Domyślnie mock włączony (dev). Ustaw `DIVIDEND_SEED_MOCK=false` przy seedzie przed pierwszym `npm run dividends:sync`. */
const SEED_MOCK_DIVIDENDS = !["false", "0", "no", "off"].includes(
  (process.env.DIVIDEND_SEED_MOCK ?? "").trim().toLowerCase(),
);

const MOCK_COMPANIES = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", industry: "Software" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", industry: "Pharma" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Defensive", industry: "Household" },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer Defensive", industry: "Beverages" },
  { symbol: "PEP", name: "PepsiCo", sector: "Consumer Defensive", industry: "Beverages" },
  { symbol: "VZ", name: "Verizon", sector: "Communication", industry: "Telecom" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", industry: "Oil & Gas" },
  { symbol: "CVX", name: "Chevron", sector: "Energy", industry: "Oil & Gas" },
  { symbol: "MMM", name: "3M", sector: "Industrials", industry: "Conglomerate" },
] as const;

/** Bazowy szablon rocznej dywidendy na akcję (8 lat). */
const BASE_ANNUAL_DPS = [0.52, 0.58, 0.65, 0.73, 0.82, 0.92, 1.02, 1.12];

function yearTemplate(symbolIndex: number): number[] {
  const m = 1 + symbolIndex * 0.12;
  return BASE_ANNUAL_DPS.map((v) => Math.round(v * m * 100) / 100);
}

function computeCagr(start: number, end: number, years: number): number | null {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return Math.round((Math.pow(end / start, 1 / years) - 1) * 10000) / 100;
}

const SEED_ALERTS: Array<{
  symbol: string;
  alertType: DividendAlertType;
  severity: number;
  confidence: number;
  message: string;
  metric: string | null;
  value: number | null;
}> = [
  {
    symbol: "AAPL",
    alertType: DividendAlertType.dividend_growth,
    severity: 42,
    confidence: 0.78,
    message: "Trailing dividend per share rose vs prior year; payout trajectory positive.",
    metric: "dps_yoy",
    value: 5.2,
  },
  {
    symbol: "MSFT",
    alertType: DividendAlertType.dividend_growth,
    severity: 55,
    confidence: 0.82,
    message: "Consistent double-digit DPS CAGR over a 5-year window.",
    metric: "cagr_5y",
    value: 10.1,
  },
  {
    symbol: "JNJ",
    alertType: DividendAlertType.dividend_cut,
    severity: 72,
    confidence: 0.91,
    message: "Annualized dividend declined vs prior fiscal year.",
    metric: "dps_yoy",
    value: -4.3,
  },
  {
    symbol: "PG",
    alertType: DividendAlertType.dividend_cut,
    severity: 38,
    confidence: 0.64,
    message: "One-off payout ratio spike after special items; monitor next quarter.",
    metric: "payout_spike",
    value: 0.78,
  },
  {
    symbol: "KO",
    alertType: DividendAlertType.anomaly,
    severity: 61,
    confidence: 0.7,
    message: "Ex-date clustering differs from historical cadence; verify corporate action feed.",
    metric: "exdate_gap_days",
    value: 18,
  },
  {
    symbol: "PEP",
    alertType: DividendAlertType.anomaly,
    severity: 49,
    confidence: 0.66,
    message: "Dividend amount series shows outlier vs 3-year median.",
    metric: "amount_zscore",
    value: 2.4,
  },
  {
    symbol: "VZ",
    alertType: DividendAlertType.sector_change,
    severity: 44,
    confidence: 0.58,
    message: "Sector median yield moved; this symbol crossed relative yield band.",
    metric: "sector_yield_spread_bp",
    value: 35,
  },
  {
    symbol: "XOM",
    alertType: DividendAlertType.sector_change,
    severity: 51,
    confidence: 0.62,
    message: "Energy peer group payout mix shifted; rebaseline sector percentile.",
    metric: "sector_percentile_delta",
    value: -8,
  },
  {
    symbol: "CVX",
    alertType: DividendAlertType.dividend_growth,
    severity: 33,
    confidence: 0.74,
    message: "Dividend resumed growth after prior flat cycle.",
    metric: "cagr_drop_recovery",
    value: 3.1,
  },
  {
    symbol: "MMM",
    alertType: DividendAlertType.anomaly,
    severity: 88,
    confidence: 0.85,
    message: "CAGR5Y inflection inconsistent with fundamentals screen; manual review suggested.",
    metric: "cagr5y_inflection",
    value: -12.5,
  },
];

function seedIntelligenceRow(
  symbol: string,
  sector: string,
  i: number,
): {
  symbol: string;
  safetyScore: number;
  safetyReason: string;
  trendDirection: DividendTrendDirection;
  sectorPercentile: number;
  lastAnalyzedAt: Date;
} {
  const trends = [
    DividendTrendDirection.up,
    DividendTrendDirection.stable,
    DividendTrendDirection.down,
    DividendTrendDirection.up,
    DividendTrendDirection.stable,
    DividendTrendDirection.up,
    DividendTrendDirection.down,
    DividendTrendDirection.stable,
    DividendTrendDirection.up,
    DividendTrendDirection.stable,
  ] as const;
  const safety = 45 + ((i * 17) % 41);
  return {
    symbol,
    safetyScore: safety,
    safetyReason: `Seed: ${symbol} in ${sector} — payout coverage, leverage, and history vs peers (dashboard Phase 10.5).`,
    trendDirection: trends[i] ?? DividendTrendDirection.stable,
    sectorPercentile: 10 + ((i * 9) % 81),
    lastAnalyzedAt: new Date(Date.now() - (i + 1) * 3_600_000),
  };
}

async function seedDividendIntelligencePhase105(): Promise<void> {
  await prisma.dividendAlert.deleteMany({});
  await prisma.dividendIntelligence.deleteMany({});

  await prisma.dividendAlert.createMany({ data: SEED_ALERTS });

  const intelData = MOCK_COMPANIES.map((c, i) => seedIntelligenceRow(c.symbol, c.sector, i));
  for (const row of intelData) {
    await prisma.dividendIntelligence.create({ data: row });
  }

  console.log("Seed OK: 10 DividendAlert + 10 DividendIntelligence (Phase 10.5).");
}

async function main() {
  for (const c of MOCK_COMPANIES) {
    await prisma.company.upsert({
      where: { symbol: c.symbol },
      create: {
        symbol: c.symbol,
        name: c.name,
        sector: c.sector,
        industry: c.industry,
      },
      update: { name: c.name, sector: c.sector, industry: c.industry },
    });
  }

  const startYear = 2017;

  if (SEED_MOCK_DIVIDENDS) {
    for (let s = 0; s < MOCK_COMPANIES.length; s++) {
      const sym = MOCK_COMPANIES[s].symbol;
      const totals = yearTemplate(s);

      await prisma.dividend.deleteMany({ where: { symbol: sym, source: "mock_seed" } });
      await prisma.dividendHistory.deleteMany({ where: { symbol: sym } });

      for (let i = 0; i < totals.length; i++) {
        const year = startYear + i;
        const totalAmount = totals[i];
        const prev = i > 0 ? totals[i - 1] : null;
        const growthYoY = prev !== null && prev > 0 ? Math.round(((totalAmount - prev) / prev) * 10000) / 100 : null;
        const cagr5Y = i >= 5 ? computeCagr(totals[i - 5], totalAmount, 5) : null;
        const cagr10Y = i >= 9 ? computeCagr(totals[i - 9], totalAmount, 9) : null;

        await prisma.dividendHistory.create({
          data: {
            symbol: sym,
            year,
            totalAmount,
            growthYoY,
            cagr5Y,
            cagr10Y,
          },
        });

        const ex = new Date(Date.UTC(year, 1, 10));
        const pay = new Date(Date.UTC(year, 2, 1));
        const yieldPct = 2.2 + (s % 5) * 0.35 + i * 0.12;

        await prisma.dividend.create({
          data: {
            symbol: sym,
            exDate: ex,
            payDate: pay,
            amount: Math.round((totalAmount / 4) * 1000) / 1000,
            currency: "USD",
            yield: Math.round(yieldPct * 100) / 100,
            frequency: "quarterly",
            source: "mock_seed",
          },
        });
      }
    }
    console.log(`Seed OK: ${MOCK_COMPANIES.length} spółek + mock dywidendy (DIVIDEND_SEED_MOCK).`);
  } else {
    console.log(
      `Seed OK: ${MOCK_COMPANIES.length} spółek (bez mock dywidend — DIVIDEND_SEED_MOCK=false). Uruchom: npm run dividends:sync (wymaga EODHD_API_KEY).`,
    );
  }

  await seedDividendIntelligencePhase105();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
