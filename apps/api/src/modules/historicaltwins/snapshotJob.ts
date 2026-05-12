import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

type QuoteSample = {
  close: number;
  high: number;
  low: number;
  volume: number;
};

type SnapshotFeatures = {
  priceClose: number;
  priceChange1d: number;
  priceChange5d: number;
  priceChange20d: number;
  volumeRatio: number;
  rsi14: number;
  embedding: number[];
};

type SnapshotJobResult = {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  stored: number;
  skipped: number;
};

const LOOKBACK_DAYS = 60;
const MIN_QUOTES = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function percentChange(latest: number, previous: number): number {
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }
  return ((latest - previous) / previous) * 100;
}

function toQuoteSamples(
  rows: Array<{
    close: unknown;
    high: unknown;
    low: unknown;
    volume: unknown;
  }>,
): QuoteSample[] {
  return rows
    .map((row) => {
      if (
        row.close == null ||
        row.high == null ||
        row.low == null ||
        row.volume == null
      ) {
        return null;
      }
      const close = Number(row.close);
      const high = Number(row.high);
      const low = Number(row.low);
      const volume = Number(row.volume);
      return { close, high, low, volume };
    })
    .filter((row): row is QuoteSample => row !== null)
    .filter(
      (row) =>
        Number.isFinite(row.close) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.volume),
    );
}

export function calculateRsi14(closesDesc: number[]): number {
  if (closesDesc.length < 15) return 50;
  const closesChronological = closesDesc.slice(0, 15).reverse();
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < closesChronological.length; i++) {
    const delta = closesChronological[i] - closesChronological[i - 1];
    if (delta > 0) gains += delta;
    if (delta < 0) losses += Math.abs(delta);
  }

  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function normalizeSigned(value: number, scale: number): number {
  return clamp(Math.tanh(value / scale), -1, 1);
}

function normalizeNonNegative(value: number, scale: number): number {
  return clamp(Math.tanh(Math.max(0, value) / scale), -1, 1);
}

export function buildSnapshotFeatures(quotes: QuoteSample[]): SnapshotFeatures | null {
  if (quotes.length < MIN_QUOTES) return null;

  const closes = quotes.map((q) => q.close);
  const volumes = quotes.map((q) => q.volume);
  const latest = quotes[0];
  if (latest.close <= 0) return null;

  const priceClose = latest.close;
  const priceChange1d = percentChange(closes[0], closes[1] ?? closes[0]);
  const priceChange5d = percentChange(closes[0], closes[5] ?? closes[0]);
  const priceChange20d = percentChange(closes[0], closes[20] ?? closes[0]);
  const shortAvgVolume = avg(volumes.slice(0, 5));
  const longAvgVolume = avg(volumes.slice(5, 25));
  const volumeRatio = longAvgVolume > 0 ? shortAvgVolume / longAvgVolume : 1;
  const rsi14 = calculateRsi14(closes);

  const priceChange1dAbs = Math.abs(priceChange1d);
  const highLowRange = latest.close > 0 ? ((latest.high - latest.low) / latest.close) * 100 : 0;
  const vwapDenominator = volumes.slice(0, 20).reduce((acc, value) => acc + value, 0);
  const vwapNumerator = quotes
    .slice(0, 20)
    .reduce((acc, row) => acc + row.close * row.volume, 0);
  const vwap = vwapDenominator > 0 ? vwapNumerator / vwapDenominator : latest.close;
  const closeVsVwap = vwap > 0 ? ((latest.close - vwap) / vwap) * 100 : 0;
  const momentum = priceChange5d - priceChange20d;

  const embedding = [
    normalizeSigned(priceChange1d, 6),
    normalizeSigned(priceChange5d, 12),
    normalizeSigned(priceChange20d, 25),
    normalizeSigned((volumeRatio - 1) * 100, 35),
    clamp((rsi14 / 100) * 2 - 1, -1, 1),
    normalizeNonNegative(priceChange1dAbs, 6),
    normalizeNonNegative(highLowRange, 4),
    normalizeSigned(closeVsVwap, 8),
    normalizeSigned(momentum, 18),
  ].map((value) => Number(value.toFixed(6)));

  return {
    priceClose,
    priceChange1d,
    priceChange5d,
    priceChange20d,
    volumeRatio,
    rsi14,
    embedding,
  };
}

function embeddingToVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(6)).join(",")}]`;
}

function snapshotDateUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function backfillOutcomes(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    WITH enriched AS (
      SELECT
        ssh.id,
        q0.close::double precision AS close_start,
        (
          SELECT q.close::double precision
          FROM quotes q
          WHERE q.symbol = ssh.symbol
            AND q.timestamp::date > ssh.snapshot_date
          ORDER BY q.timestamp ASC
          OFFSET 4 LIMIT 1
        ) AS close_5d,
        (
          SELECT q.close::double precision
          FROM quotes q
          WHERE q.symbol = ssh.symbol
            AND q.timestamp::date > ssh.snapshot_date
          ORDER BY q.timestamp ASC
          OFFSET 19 LIMIT 1
        ) AS close_20d,
        (
          SELECT q.close::double precision
          FROM quotes q
          WHERE q.symbol = ssh.symbol
            AND q.timestamp::date > ssh.snapshot_date
          ORDER BY q.timestamp ASC
          OFFSET 59 LIMIT 1
        ) AS close_60d
      FROM stock_setups_history ssh
      LEFT JOIN LATERAL (
        SELECT q.close
        FROM quotes q
        WHERE q.symbol = ssh.symbol
          AND q.timestamp::date <= ssh.snapshot_date
        ORDER BY q.timestamp DESC
        LIMIT 1
      ) q0 ON true
    )
    UPDATE stock_setups_history ssh
    SET
      outcome_5d = CASE
        WHEN e.close_start IS NULL OR e.close_5d IS NULL OR e.close_start = 0 THEN ssh.outcome_5d
        ELSE ROUND((((e.close_5d - e.close_start) / e.close_start) * 100)::numeric, 6)::double precision
      END,
      outcome_20d = CASE
        WHEN e.close_start IS NULL OR e.close_20d IS NULL OR e.close_start = 0 THEN ssh.outcome_20d
        ELSE ROUND((((e.close_20d - e.close_start) / e.close_start) * 100)::numeric, 6)::double precision
      END,
      outcome_60d = CASE
        WHEN e.close_start IS NULL OR e.close_60d IS NULL OR e.close_start = 0 THEN ssh.outcome_60d
        ELSE ROUND((((e.close_60d - e.close_start) / e.close_start) * 100)::numeric, 6)::double precision
      END
    FROM enriched e
    WHERE ssh.id = e.id
      AND (
        ssh.outcome_5d IS NULL
        OR ssh.outcome_20d IS NULL
        OR ssh.outcome_60d IS NULL
      );
  `);
}

export async function runSnapshotJob(prisma: PrismaClient): Promise<SnapshotJobResult> {
  const startedAt = new Date();
  const snapshotDate = snapshotDateUtc(startedAt);
  const fromDate = new Date(startedAt.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const symbols = await prisma.company.findMany({
    select: { symbol: true },
    orderBy: { symbol: "asc" },
  });

  let stored = 0;
  let skipped = 0;

  for (const { symbol } of symbols) {
    const quoteRows = await prisma.quote.findMany({
      where: {
        symbol,
        timestamp: { gte: fromDate },
      },
      orderBy: { timestamp: "desc" },
      take: LOOKBACK_DAYS,
      select: {
        close: true,
        high: true,
        low: true,
        volume: true,
      },
    });

    const samples = toQuoteSamples(quoteRows);
    const features = buildSnapshotFeatures(samples);
    if (!features) {
      skipped += 1;
      continue;
    }

    const hasInvalidFeature =
      !Number.isFinite(features.priceClose) ||
      !Number.isFinite(features.priceChange5d) ||
      !Number.isFinite(features.priceChange20d) ||
      !Number.isFinite(features.volumeRatio) ||
      !Number.isFinite(features.rsi14) ||
      features.embedding.length !== 9 ||
      features.embedding.some((value) => !Number.isFinite(value));
    if (hasInvalidFeature) {
      skipped += 1;
      continue;
    }

    const vectorLiteral = embeddingToVectorLiteral(features.embedding);
    const inserted = await prisma.$executeRawUnsafe(
      `
        INSERT INTO stock_setups_history (
          id,
          ticker,
          symbol,
          snapshot_date,
          price_close,
          price_change_5d,
          price_change_20d,
          volume_ratio,
          rsi_14,
          embedding,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, NOW())
        ON CONFLICT DO NOTHING
      `,
      randomUUID(),
      symbol,
      symbol,
      snapshotDate,
      features.priceClose,
      features.priceChange5d,
      features.priceChange20d,
      features.volumeRatio,
      features.rsi14,
      vectorLiteral,
    );
    stored += Number(inserted) > 0 ? 1 : 0;
    if (Number(inserted) <= 0) skipped += 1;
  }

  await backfillOutcomes(prisma);

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    scanned: symbols.length,
    stored,
    skipped,
  };
}
