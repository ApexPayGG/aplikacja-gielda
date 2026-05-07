import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { Prisma } from "@prisma/client";
import { PolygonClient } from "../../../../packages/data/src/polygon/client";
import { prisma } from "../db/index";
import { createRedisConnection, getCacheRedis } from "../redis";

export const FETCH_QUOTES_QUEUE_NAME = "fetch-quotes";
export const FETCH_QUOTES_JOB_NAME = "fetch-quotes";
export const FETCH_QUOTES_DLQ_QUEUE_NAME = "fetch-quotes-dlq";

const INGEST_STATS_KEY = "live-ingest:last";
const INGEST_STATS_TTL_SEC = 600;

export const fetchPolygonQuotesLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "fetch_polygon_quotes" },
});

export interface FetchPolygonQuotesResult {
  traceId: string;
  tickersTargeted: number;
  upserted: number;
  failed: number;
  dlqEnqueued: number;
  ingestBucket: string;
}

export interface FetchPolygonQuotesDeps {
  db: typeof prisma;
  polygon: Pick<PolygonClient, "getTopStocks" | "getLatestQuote">;
  dlq: Pick<Queue, "add">;
  cache: Pick<ReturnType<typeof getCacheRedis>, "setex">;
  topLimit: number;
  traceId: string;
  ingestBucket: Date;
}

function floorToFiveMinuteUtc(d: Date): Date {
  const ms = 5 * 60 * 1000;
  return new Date(Math.floor(d.getTime() / ms) * ms);
}

export function buildQuoteIdempotencyKey(ticker: string, bucket: Date): string {
  const t = ticker.toUpperCase();
  const iso = floorToFiveMinuteUtc(bucket).toISOString();
  return createHash("sha256").update(`${t}:${iso}`).digest("hex");
}

function toDec2(n: number | undefined | null): Prisma.Decimal | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return new Prisma.Decimal(n.toFixed(2));
}

function toDec2Required(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

export async function runFetchPolygonQuotesJob(deps: FetchPolygonQuotesDeps): Promise<FetchPolygonQuotesResult> {
  const bucket = floorToFiveMinuteUtc(deps.ingestBucket);
  const traceId = deps.traceId;
  const tickers = await deps.polygon.getTopStocks(deps.topLimit, traceId);

  let upserted = 0;
  let failed = 0;
  let dlqEnqueued = 0;

  for (const raw of tickers) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) continue;
    const idempotencyKey = buildQuoteIdempotencyKey(ticker, bucket);
    try {
      const q = await deps.polygon.getLatestQuote(ticker, traceId);
      await deps.db.liveQuote.upsert({
        where: { idempotencyKey },
        create: {
          ticker,
          idempotencyKey,
          price: toDec2Required(q.price),
          open: toDec2(q.open),
          high: toDec2(q.high),
          low: toDec2(q.low),
          close: toDec2(q.close),
          volume: q.volume ?? null,
          vwap: toDec2(q.vwap),
          createdAt: bucket,
        },
        update: {
          price: toDec2Required(q.price),
          open: toDec2(q.open),
          high: toDec2(q.high),
          low: toDec2(q.low),
          close: toDec2(q.close),
          volume: q.volume ?? null,
          vwap: toDec2(q.vwap),
        },
      });
      upserted += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      fetchPolygonQuotesLogger.warn({ traceId, ticker, err: msg }, "ticker fetch failed");
      try {
        await deps.dlq.add(
          "fetch-quotes-failed",
          { ticker, traceId, error: msg, at: new Date().toISOString() },
          { removeOnComplete: 500, removeOnFail: false },
        );
        dlqEnqueued += 1;
      } catch (dlqErr) {
        fetchPolygonQuotesLogger.error({ traceId, ticker, err: dlqErr }, "dlq enqueue failed");
      }
    }
  }

  const result: FetchPolygonQuotesResult = {
    traceId,
    tickersTargeted: tickers.length,
    upserted,
    failed,
    dlqEnqueued,
    ingestBucket: bucket.toISOString(),
  };

  try {
    await deps.cache.setex(INGEST_STATS_KEY, INGEST_STATS_TTL_SEC, JSON.stringify(result));
  } catch (e) {
    fetchPolygonQuotesLogger.warn({ traceId, err: e }, "ingest stats cache set failed");
  }

  fetchPolygonQuotesLogger.info(result, "fetch polygon quotes done");
  return result;
}

export function registerFetchPolygonQuotes(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker; dlq: Queue } {
  const queue = new Queue(FETCH_QUOTES_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    },
  });
  const dlq = new Queue(FETCH_QUOTES_DLQ_QUEUE_NAME, { connection: queueConnection });

  const worker = new Worker(
    FETCH_QUOTES_QUEUE_NAME,
    async (job) => {
      const traceId = randomUUID();
      fetchPolygonQuotesLogger.info({ jobId: job.id, traceId }, "job start");
      const polygon = new PolygonClient({
        logger: fetchPolygonQuotesLogger.child({ traceId }),
      });
      const out = await runFetchPolygonQuotesJob({
        db: prisma,
        polygon,
        dlq,
        cache: getCacheRedis(),
        topLimit: 100,
        traceId,
        ingestBucket: new Date(),
      });
      return out;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    fetchPolygonQuotesLogger.error(
      { jobId: job?.id, err: err instanceof Error ? err.message : String(err) },
      "worker job failed",
    );
  });

  return { queue, worker, dlq };
}

export async function scheduleFetchPolygonQuotesJob(queue: Queue): Promise<void> {
  await queue.add(
    FETCH_QUOTES_JOB_NAME,
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: "polygon-fetch-quotes-every-5-min",
    },
  );
}
