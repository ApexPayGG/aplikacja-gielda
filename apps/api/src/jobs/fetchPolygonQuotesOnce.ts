/**
 * One-shot Polygon live quotes ingest (GitHub cron / manual `npm run job:fetch-quotes`).
 */
import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import type IORedis from "ioredis";
import { PolygonClient } from "../../../../packages/data/src/polygon/client";
import { prisma } from "../db/index";
import { createRedisConnection, getCacheRedis } from "../redis";
import {
  FETCH_QUOTES_DLQ_QUEUE_NAME,
  fetchPolygonQuotesLogger,
  runFetchPolygonQuotesJob,
} from "./fetchPolygonQuotes";

async function main(): Promise<void> {
  const traceId = randomUUID();
  let connection: IORedis | undefined;
  let dlq: Queue | undefined;
  let cache: ReturnType<typeof getCacheRedis> | undefined;
  try {
    cache = getCacheRedis();
    connection = createRedisConnection();
    dlq = new Queue(FETCH_QUOTES_DLQ_QUEUE_NAME, { connection });
    const polygon = new PolygonClient({
      logger: fetchPolygonQuotesLogger.child({ traceId }),
    });
    const topLimit = Number(process.env.POLYGON_TOP_STOCKS_LIMIT ?? "100");
    const out = await runFetchPolygonQuotesJob({
      db: prisma,
      polygon,
      dlq,
      cache,
      topLimit: Number.isFinite(topLimit) && topLimit > 0 ? topLimit : 100,
      liveQuoteSymbolsEnv: process.env.POLYGON_LIVE_QUOTES_SYMBOLS,
      traceId,
      ingestBucket: new Date(),
    });
    console.log(JSON.stringify(out));
  } finally {
    await dlq?.close();
    if (connection) await connection.quit();
    try {
      await cache?.quit();
    } catch {
      /* ignore */
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
