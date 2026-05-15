import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import pino from "pino";
import { prisma } from "../db/index";
import { getCacheRedis } from "../redis";

const QUOTES_RATE_LIMIT = 50;
const QUOTES_RATE_WINDOW_SEC = 60;

type RedisRateStore = Pick<ReturnType<typeof getCacheRedis>, "incr" | "expire" | "ttl">;

type QuotesRouteDeps = {
  db: typeof prisma;
  rateStore: RedisRateStore;
  getClientIp: (req: Request) => string;
};

const quotesLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "quotes_route" },
});

function defaultClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function applyRateLimit(
  rateStore: RedisRateStore,
  key: string,
): Promise<
  | { ok: true; remaining: number; resetUnix: number }
  | { ok: false; retryAfterSec: number }
> {
  const count = await rateStore.incr(key);
  if (count === 1) {
    await rateStore.expire(key, QUOTES_RATE_WINDOW_SEC);
  }
  const ttlSec = await rateStore.ttl(key);
  const windowTtl = ttlSec > 0 ? ttlSec : QUOTES_RATE_WINDOW_SEC;
  const resetUnix = Math.floor(Date.now() / 1000) + windowTtl;
  if (count > QUOTES_RATE_LIMIT) {
    return { ok: false, retryAfterSec: Math.max(1, ttlSec) };
  }
  return {
    ok: true,
    remaining: Math.max(0, QUOTES_RATE_LIMIT - count),
    resetUnix,
  };
}

function parseTicker(q: unknown): string | null {
  const t = String(q ?? "").trim().toUpperCase();
  if (!t || !/^[A-Z0-9.-]{1,10}$/.test(t)) return null;
  return t;
}

function serializeLiveQuote(row: {
  id: bigint;
  ticker: string;
  price: Prisma.Decimal;
  open: Prisma.Decimal | null;
  high: Prisma.Decimal | null;
  low: Prisma.Decimal | null;
  close: Prisma.Decimal | null;
  volume: bigint | null;
  vwap: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id.toString(),
    ticker: row.ticker,
    price: row.price.toString(),
    open: row.open?.toString() ?? null,
    high: row.high?.toString() ?? null,
    low: row.low?.toString() ?? null,
    close: row.close?.toString() ?? null,
    volume: row.volume != null ? row.volume.toString() : null,
    vwap: row.vwap?.toString() ?? null,
    source: "live_quotes",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createQuotesRouter(deps?: Partial<QuotesRouteDeps>): Router {
  const db = deps?.db ?? prisma;
  const rateStore = deps?.rateStore ?? getCacheRedis();
  const getClientIp = deps?.getClientIp ?? defaultClientIp;

  const router = Router();
  // Public endpoints: do not attach auth middleware here.

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const rl = await applyRateLimit(rateStore, `quotes:rl:${ip}`);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec ?? 60));
      return res.status(429).json({ error: "Rate limit exceeded", retryAfterSec: rl.retryAfterSec });
    }
    res.setHeader("X-RateLimit-Limit", String(QUOTES_RATE_LIMIT));
    res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    res.setHeader("X-RateLimit-Reset", String(rl.resetUnix));
    next();
  });

  router.get("/api/quotes/latest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = parseTicker(req.query.ticker);
      if (!ticker) return res.status(400).json({ error: "Invalid or missing ticker" });
      const row = await db.liveQuote.findFirst({
        where: { ticker },
        orderBy: { createdAt: "desc" },
      });
      if (!row) return res.status(404).json({ error: "No live quote for ticker" });
      res.json({ quote: serializeLiveQuote(row) });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/quotes/history", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = parseTicker(req.query.ticker);
      if (!ticker) return res.status(400).json({ error: "Invalid or missing ticker" });
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const rows = await db.liveQuote.findMany({
        where: { ticker },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      res.json({
        ticker,
        limit,
        count: rows.length,
        quotes: rows.map(serializeLiveQuote),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/quotes/ingest-status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = await getCacheRedis().get("live-ingest:last");
      if (!raw) {
        return res.status(404).json({ error: "No recent ingest summary in cache (run job:fetch-quotes first)" });
      }
      res.json(JSON.parse(raw) as Record<string, unknown>);
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/quotes/top", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
      const rows = await db.$queryRaw<
        Array<{
          id: bigint;
          ticker: string;
          price: Prisma.Decimal;
          open: Prisma.Decimal | null;
          high: Prisma.Decimal | null;
          low: Prisma.Decimal | null;
          close: Prisma.Decimal | null;
          volume: bigint | null;
          vwap: Prisma.Decimal | null;
          created_at: Date;
          updated_at: Date;
        }>
      >(Prisma.sql`
        WITH latest AS (
          SELECT DISTINCT ON ("ticker") *
          FROM live_quotes
          ORDER BY "ticker", "created_at" DESC
        )
        SELECT * FROM latest
        ORDER BY "volume" DESC NULLS LAST
        LIMIT ${limit}
      `);
      const mapped = rows.map((r) =>
        serializeLiveQuote({
          id: r.id,
          ticker: r.ticker,
          price: r.price,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
          vwap: r.vwap,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }),
      );
      res.json({ limit, count: mapped.length, quotes: mapped });
    } catch (e) {
      quotesLogger.error({ err: e }, "top quotes query failed");
      next(e);
    }
  });

  return router;
}
