import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import pino from "pino";
import { prisma } from "../db/index";
import { getCacheRedis } from "../redis";
import {
  buildQuoteSymbolCandidates,
  MIN_QUOTE_HISTORY_BARS,
} from "../utils/quoteSymbolResolution";

const QUOTES_RATE_LIMIT = 50;
const QUOTES_RATE_WINDOW_SEC = 60;
const POPULAR_TOP_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "JPM",
  "JNJ",
  "KO",
  "V",
  "XOM",
] as const;

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

function baseTickerSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/, "");
}

function isUsSuffixedTicker(symbol: string): boolean {
  return /\.US$/i.test(symbol.trim());
}

function serializeHistoricalQuoteFallback(row: {
  id: bigint;
  symbol: string;
  open: Prisma.Decimal;
  high: Prisma.Decimal;
  low: Prisma.Decimal;
  close: Prisma.Decimal;
  volume: bigint;
  timestamp: Date;
}) {
  return {
    id: row.id.toString(),
    ticker: row.symbol,
    price: row.close.toString(),
    open: row.open.toString(),
    high: row.high.toString(),
    low: row.low.toString(),
    close: row.close.toString(),
    volume: row.volume.toString(),
    vwap: null,
    source: "quotes_fallback",
    createdAt: row.timestamp.toISOString(),
    updatedAt: row.timestamp.toISOString(),
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
      const candidates = buildQuoteSymbolCandidates(ticker);
      for (const candidate of candidates) {
        const row = await db.liveQuote.findFirst({
          where: { ticker: candidate },
          orderBy: { createdAt: "desc" },
        });
        if (row) {
          return res.json({
            quote: serializeLiveQuote(row),
            resolvedSymbol: candidate,
          });
        }
      }

      const fallback = await db.quote.findFirst({
        where: { symbol: { in: candidates } },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      });
      if (!fallback) return res.status(404).json({ error: "No quote found for ticker" });
      res.json({
        quote: serializeHistoricalQuoteFallback(fallback),
        resolvedSymbol: fallback.symbol,
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/quotes/history", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = parseTicker(req.query.ticker);
      if (!ticker) return res.status(400).json({ error: "Invalid or missing ticker" });
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const candidates = buildQuoteSymbolCandidates(ticker);

      let bestLive: { candidate: string; rows: ReturnType<typeof serializeLiveQuote>[] } | null = null;
      for (const candidate of candidates) {
        const rows = await db.liveQuote.findMany({
          where: { ticker: candidate },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        if (rows.length > (bestLive?.rows.length ?? 0)) {
          bestLive = { candidate, rows: rows.map(serializeLiveQuote) };
        }
      }
      if (bestLive && bestLive.rows.length >= MIN_QUOTE_HISTORY_BARS) {
        return res.json({
          ticker,
          resolvedSymbol: bestLive.candidate,
          limit,
          count: bestLive.rows.length,
          quotes: bestLive.rows,
          source: "live_quotes",
        });
      }

      const days = Math.min(365, Math.max(1, Math.ceil(limit / 2)));
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);
      for (const candidate of candidates) {
        const legacyRows = await db.quote.findMany({
          where: {
            symbol: candidate,
            timestamp: { gte: since },
          },
          orderBy: { timestamp: "asc" },
        });
        if (legacyRows.length >= MIN_QUOTE_HISTORY_BARS) {
          const sliced = legacyRows.slice(-limit);
          return res.json({
            ticker,
            resolvedSymbol: candidate,
            limit,
            count: sliced.length,
            quotes: sliced.map((row) =>
              serializeHistoricalQuoteFallback({
                id: row.id,
                symbol: row.symbol,
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                volume: row.volume,
                timestamp: row.timestamp,
              }),
            ),
            source: "quotes_fallback",
          });
        }
      }

      res.json({
        ticker,
        resolvedSymbol: ticker,
        limit,
        count: bestLive?.rows.length ?? 0,
        quotes: bestLive?.rows ?? [],
        source: bestLive ? "live_quotes" : "none",
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
      let mapped = rows.map((r) =>
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

      if (mapped.length === 0) {
        const fallbackRows = await db.$queryRaw<
          Array<{
            id: bigint;
            symbol: string;
            open: Prisma.Decimal;
            high: Prisma.Decimal;
            low: Prisma.Decimal;
            close: Prisma.Decimal;
            volume: bigint;
            timestamp: Date;
          }>
        >(Prisma.sql`
          WITH candidates AS (
            SELECT
              "id",
              "symbol",
              "open",
              "high",
              "low",
              "close",
              "volume",
              "timestamp",
              regexp_replace("symbol", '\\.US$', '') AS "base_symbol",
              CASE WHEN "symbol" ~ '\\.US$' THEN 1 ELSE 0 END AS "suffix_rank"
            FROM "quotes"
            WHERE regexp_replace("symbol", '\\.US$', '') IN (${Prisma.join(POPULAR_TOP_TICKERS)})
          ),
          deduplicated AS (
            SELECT DISTINCT ON ("base_symbol")
              "id",
              "symbol",
              "open",
              "high",
              "low",
              "close",
              "volume",
              "timestamp"
            FROM candidates
            ORDER BY "base_symbol", "suffix_rank" ASC, "timestamp" DESC, "id" DESC
          )
          SELECT
            "id",
            "symbol",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "timestamp"
          FROM deduplicated
          ORDER BY "volume" DESC NULLS LAST
          LIMIT ${limit}
        `);
        const bestByBase = new Map<string, (typeof fallbackRows)[number]>();
        for (const row of fallbackRows) {
          const base = baseTickerSymbol(row.symbol);
          const current = bestByBase.get(base);
          if (!current) {
            bestByBase.set(base, row);
            continue;
          }
          const currentHasSuffix = isUsSuffixedTicker(current.symbol);
          const candidateHasSuffix = isUsSuffixedTicker(row.symbol);
          const candidateIsPreferred =
            (!candidateHasSuffix && currentHasSuffix) ||
            (candidateHasSuffix === currentHasSuffix &&
              (row.timestamp.getTime() > current.timestamp.getTime() ||
                (row.timestamp.getTime() === current.timestamp.getTime() && row.id > current.id)));
          if (candidateIsPreferred) {
            bestByBase.set(base, row);
          }
        }

        mapped = Array.from(bestByBase.values())
          .sort((a, b) => {
            const aVolume = a.volume ?? BigInt(0);
            const bVolume = b.volume ?? BigInt(0);
            if (aVolume === bVolume) return b.timestamp.getTime() - a.timestamp.getTime();
            return bVolume > aVolume ? 1 : -1;
          })
          .slice(0, limit)
          .map((row) => {
            const serialized = serializeHistoricalQuoteFallback(row);
            return {
              ...serialized,
              internalTicker: serialized.ticker,
              ticker: serialized.ticker.replace(/\.US$/, ""),
            };
          });
      }

      res.json({ limit, count: mapped.length, quotes: mapped });
    } catch (e) {
      quotesLogger.error({ err: e }, "top quotes query failed");
      next(e);
    }
  });

  return router;
}
