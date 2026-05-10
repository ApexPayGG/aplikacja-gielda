import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import express from "express";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { analyzeStock } from "./ai/analysis";
import { cacheJsonGet, cacheJsonSet } from "./cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "./config/redis";
import { prisma } from "./db/index";
import {
  getCompaniesBySector,
  getCompanyBySymbol,
  searchCompanies,
  upsertCompany,
} from "./db/company-queries";
import {
  getLatestIndicator,
  getLatestQuote,
  getQuoteHistory,
  getRecentNews,
  insertIndicator,
  insertNews,
  insertQuote,
} from "./db/queries";
import {
  fetchAlphaVantageLatestRSI,
  fetchCompanyProfile,
  fetchFinnhubCompanyNews,
  fetchFinnhubQuoteDetailed,
} from "./scrapers/index";
import { redisStatsHandler } from "./routes/redisStats";
import {
  calculateTaxPL,
  estimateGrossDividend,
  getDividendHistory,
  searchGrowthScreener,
} from "./services/dividendService";
import {
  getDividendIntelligence,
  getRecentAlerts,
  getSectorComparison,
} from "./services/dividendIntelligenceService";
import type { SustainabilityBreakdown } from "./types/sustainability";
import {
  breakdownFromRow,
  getSustainabilityScoreRow,
} from "./services/dividendSustainabilityPersistenceService";
import { createCopilotRouter } from "./routes/copilot";
import { createDividendsRouter } from "./routes/dividends";
import { createDividendRouter } from "./routes/dividend";
import { createBacktestRouter } from "./routes/backtest";
import { createPortfolioRouter } from "./routes/portfolio";
import { createPaperTradingRouter } from "./routes/paperTrading";
import { createExitIntelligenceRouter } from "./routes/exitIntelligence";
import { createQuotesRouter } from "./routes/quotes";
import { createAlphaJournalRouter } from "./routes/alphaJournal";
import { createAlphaCalendarRouter } from "./routes/alphaCalendar";
import { createSignalMemoryRouter } from "./routes/signalMemory";
import { createSignalDnaRouter } from "./routes/signalDna";
import { createReverseScreenerRouter } from "./routes/reversescreener";
import { createPositionSizeRouter } from "./routes/positionSize";
import { createStressTestRouter } from "./routes/stressTest";
import { createConcentrationRouter } from "./routes/concentration";
import { createCorrelationRouter } from "./routes/correlation";
import { createReactionsRouter } from "./routes/reactions";
import { createTaxRouter } from "./routes/tax";
import { createBehavioralRouter } from "./routes/behavioral";
import { createPsycheRouter } from "./routes/psyche";
import { createPreMortemRouter } from "./routes/premortem";
import { createEmotionalRouter } from "./routes/emotional";
import { createReplayRouter } from "./routes/replay";
import { createStrategyDnaRouter } from "./routes/strategydna";
import { createTrackRecordRouter } from "./routes/trackrecord";
import { createMirrorRouter } from "./routes/mirror";
import { createCrowdWisdomRouter } from "./routes/crowdwisdom";
import { createGlossaryRouter } from "./routes/glossary";
import { createDigestRouter } from "./routes/digest";
import { createDiscordSyncRouter } from "./routes/discordSync";
import { createSkillTreeRouter } from "./routes/skilltree";
import { createNewsHalfLifeRouter } from "./routes/newshalflife";
import { createVolatilityRouter } from "./routes/volatility";
import { createEarningsRouter } from "./routes/earnings";
import { createInsiderRouter } from "./routes/insider";
import { createDividendCalcRouter } from "./routes/dividendcalc";
import { sendDailyDigests } from "./modules/digest/dailyDigestModule";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function msUntilNextUtcEight(now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return Math.max(0, next.getTime() - now.getTime());
}

function scheduleDailyDigestJob(): void {
  const run = async () => {
    try {
      const result = await sendDailyDigests();
      console.log(`[digest] sendDailyDigests done sent=${result.sent} failed=${result.failed}`);
    } catch (error) {
      console.error("[digest] sendDailyDigests failed", error);
    } finally {
      setTimeout(() => {
        void run();
      }, 24 * 60 * 60 * 1000);
    }
  };

  const initialDelayMs = msUntilNextUtcEight();
  console.log(
    `[digest] Daily digest cron armed for 08:00 UTC (starts in ${Math.round(initialDelayMs / 1000)}s)`,
  );
  setTimeout(() => {
    void run();
  }, initialDelayMs);
}

function isDatabaseUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message;
  return (
    m.includes("Can't reach database server") ||
    m.includes("Connection refused") ||
    m.includes("ECONNREFUSED") ||
    m.includes("P1001") ||
    m.includes("P1000")
  );
}

function isAnalysisConfigurationError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("ANTHROPIC_API_KEY is not set");
}

/**
 * Włącza `screenerDebug` + `sqlDebug` i omija Redis cache w `searchGrowthScreener`.
 * 1) Query: `debug=1` | `debug=true` (string z Express).
 * 2) Surowy URL / nagłówek — na wypadek gdy shell psuje `&debug=1` w curl (CMD).
 */
function isDividendGrowthScreenerDebugRequest(req: Request): boolean {
  const d = req.query.debug;
  // Jawna specyfikacja (req.query to zwykle string):
  if (d === "1" || d === "true") return true;
  if (Array.isArray(d) && d.some((x) => x === "1" || x === "true")) return true;
  if (String(d ?? "").toLowerCase() === "true" || String(d ?? "").toLowerCase() === "yes") return true;

  const raw = req.originalUrl ?? req.url ?? "";
  if (/(?:[?&])debug=(?:1|true|yes)(?:&|$|#)/i.test(raw)) return true;

  const h = req.headers["x-dividend-screener-debug"] ?? req.headers["x-screener-debug"];
  if (h === "1" || String(h ?? "").toLowerCase() === "true") return true;

  return false;
}

export function createApp(): express.Express {
  const app = express();

  app.set("json replacer", (_key: string, value: unknown) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Prisma.Decimal) return value.toString();
    return value;
  });

  app.use(
    cors({
      origin: ["http://localhost:5173", "http://localhost:5174"],
      credentials: false,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(createCopilotRouter());
  app.use(createDividendsRouter());
  app.use(createDividendRouter());
  app.use(createBacktestRouter());
  app.use(createPortfolioRouter());
  app.use(createPaperTradingRouter());
  app.use(createExitIntelligenceRouter());
  app.use(createQuotesRouter());
  app.use(createAlphaJournalRouter());
  app.use(createAlphaCalendarRouter());
  app.use(createSignalMemoryRouter());
  app.use(createSignalDnaRouter());
  app.use(createReverseScreenerRouter());
  app.use(createBehavioralRouter());
  app.use(createPsycheRouter());
  app.use(createEmotionalRouter());
  app.use(createPreMortemRouter());
  app.use(createReplayRouter());
  app.use(createStrategyDnaRouter());
  app.use(createTrackRecordRouter());
  app.use(createMirrorRouter());
  app.use(createSkillTreeRouter());
  app.use(createEarningsRouter());
  app.use(createInsiderRouter());
  app.use(createNewsHalfLifeRouter());
  app.use(createCrowdWisdomRouter());
  app.use(createGlossaryRouter());
  app.use(createDigestRouter());
  app.use(createDiscordSyncRouter());
  app.use(createVolatilityRouter());
  app.use(createDividendCalcRouter());
  app.use("/api/position-size", createPositionSizeRouter(prisma));
  app.use("/api/stress-test", createStressTestRouter(prisma));
  app.use("/api/concentration", createConcentrationRouter(prisma));
  app.use(createCorrelationRouter());
  app.use(createReactionsRouter());
  app.use("/api/tax", createTaxRouter(prisma));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "stockai-api", ts: new Date().toISOString() });
  });

  app.get("/api/redis/stats", redisStatsHandler);

  app.post("/api/test/scrape/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = (req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const profile = await fetchCompanyProfile(symbol);
      const company = await upsertCompany(symbol, profile);
      res.json({ success: true, company });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/test/populate/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = (req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const sym = symbol.toUpperCase();

      const profile = await fetchCompanyProfile(sym);
      const company = await upsertCompany(sym, profile);

      const quoteData = await fetchFinnhubQuoteDetailed(sym);
      let quote;
      try {
        quote = await insertQuote(sym, {
          timestamp: new Date(quoteData.timestampMs),
          open: quoteData.open,
          high: quoteData.high,
          low: quoteData.low,
          close: quoteData.close,
          volume: quoteData.volume,
          source: "finnhub",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Unique constraint") || msg.includes("P2002")) {
          const existing = await getLatestQuote(sym);
          if (!existing) throw e;
          quote = existing;
        } else {
          throw e;
        }
      }

      const newsItems = await fetchFinnhubCompanyNews(sym, 14);
      const news: Awaited<ReturnType<typeof insertNews>>[] = [];
      for (const n of newsItems.slice(0, 3)) {
        const ts = n.datetime < 1e12 ? n.datetime * 1000 : n.datetime;
        const row = await insertNews(sym, {
          timestamp: new Date(ts),
          title: n.headline.slice(0, 500),
          url: n.url,
          sentiment: null,
          source: n.source || "finnhub",
        });
        news.push(row);
      }

      await sleep(1500);
      const rsi = await fetchAlphaVantageLatestRSI(sym, 14);
      const indicator = await insertIndicator(sym, rsi.indicator, rsi.value);

      res.json({ success: true, company, quote, news, indicator });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/companies/search", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (!q) return res.status(400).json({ error: "Missing query parameter q" });
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const cacheKey = redisKeys.companySearch(q, limit);
      const cached = await cacheJsonGet<{ query: string; count: number; data: unknown[] }>(cacheKey);
      if (cached !== null) {
        res.json(cached);
        return;
      }
      const rows = await searchCompanies(q, limit);
      const payload = { query: q, count: rows.length, data: rows };
      await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.SEARCH);
      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/companies/sector/:sector", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sector = decodeURIComponent(req.params.sector ?? "");
      if (!sector) return res.status(400).json({ error: "Missing sector" });
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
      const result = await getCompaniesBySector(sector, page, pageSize);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/companies/:symbol/brief", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sym = (req.params.symbol ?? "").trim().toUpperCase();
      if (!sym) return res.status(400).json({ error: "Missing symbol" });
      const lang = String(req.query.lang ?? "en").trim() || "en";
      const result = await analyzeStock(sym, lang);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/companies/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await getCompanyBySymbol(req.params.symbol ?? "");
      if (!row) return res.status(404).json({ error: "Company not found" });
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/quotes/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sym = (req.params.symbol ?? "").trim().toUpperCase();
      if (!sym) return res.status(400).json({ error: "Missing symbol" });
      const cacheKey = redisKeys.quoteLatest(sym);
      const cached = await cacheJsonGet<unknown>(cacheKey);
      if (cached !== null) {
        res.json(cached);
        return;
      }
      const row = await getLatestQuote(sym);
      if (!row) return res.status(404).json({ error: "No quote found" });
      await cacheJsonSet(cacheKey, row, REDIS_TTL_SEC.QUOTES);
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/quotes/:symbol/history", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
      const rows = await getQuoteHistory(req.params.symbol ?? "", days);
      res.json({ symbol: (req.params.symbol ?? "").toUpperCase(), days, count: rows.length, data: rows });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/news/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sym = (req.params.symbol ?? "").trim().toUpperCase();
      if (!sym) return res.status(400).json({ error: "Missing symbol" });
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
      const cacheKey = redisKeys.newsRecent(sym, limit);
      const cached = await cacheJsonGet<{
        symbol: string;
        limit: number;
        count: number;
        data: unknown[];
      }>(cacheKey);
      if (cached !== null) {
        res.json(cached);
        return;
      }
      const rows = await getRecentNews(sym, limit);
      const payload = { symbol: sym, limit, count: rows.length, data: rows };
      await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.NEWS);
      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/indicators/:symbol/:indicator", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ind = (req.params.indicator ?? "").toUpperCase();
      const row = await getLatestIndicator(req.params.symbol ?? "", ind);
      if (!row) return res.status(404).json({ error: "No indicator row found" });
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/analysis/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang = String(req.query.lang ?? "pl").trim() || "pl";
      const result = await analyzeStock(req.params.symbol ?? "", lang);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/dividends/tax-calculator-pl", (req: Request, res: Response) => {
    try {
      const body = req.body as {
        shares?: unknown;
        currentPrice?: unknown;
        dividendPerShare?: unknown;
        annualDividendYieldPercent?: unknown;
      };
      const shares = Number(body.shares);
      const currentPrice = Number(body.currentPrice);
      if (!Number.isFinite(shares) || !Number.isFinite(currentPrice)) {
        return res.status(400).json({ error: "Wymagane liczby: shares, currentPrice" });
      }
      const dividendPerShare =
        body.dividendPerShare !== undefined ? Number(body.dividendPerShare) : undefined;
      const annualDividendYieldPercent =
        body.annualDividendYieldPercent !== undefined
          ? Number(body.annualDividendYieldPercent)
          : undefined;

      let gross: number;
      let method: string;
      try {
        const est = estimateGrossDividend({
          shares,
          currentPrice,
          dividendPerShare:
            dividendPerShare !== undefined && Number.isFinite(dividendPerShare)
              ? dividendPerShare
              : undefined,
          annualDividendYieldPercent:
            annualDividendYieldPercent !== undefined && Number.isFinite(annualDividendYieldPercent)
              ? annualDividendYieldPercent
              : undefined,
        });
        gross = est.grossDividend;
        method = est.method;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid input";
        return res.status(400).json({ error: msg });
      }

      const tax = calculateTaxPL(gross);
      res.json({
        ...tax,
        method,
        inputs: { shares, currentPrice, dividendPerShare, annualDividendYieldPercent },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bad request";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/screeners/dividend/growth", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const minYears = Math.min(30, Math.max(1, parseInt(String(_req.query.minYears ?? "5"), 10) || 5));
      const minYield = Math.min(50, Math.max(0, parseFloat(String(_req.query.minYield ?? "3")) || 3));
      const limit = Math.min(50, Math.max(1, parseInt(String(_req.query.limit ?? "50"), 10) || 50));
      const page = Math.max(1, parseInt(String(_req.query.page ?? "1"), 10) || 1);
      const offset = (page - 1) * limit;
      const debug = isDividendGrowthScreenerDebugRequest(_req);

      const result = await searchGrowthScreener({
        minYears,
        minYield,
        limit,
        offset,
        includeDebug: debug,
      });

      let sqlDebug: Record<string, unknown> | undefined;
      if (debug) {
        const [dhRow] = await prisma.$queryRaw<[{ c: bigint }]>`SELECT COUNT(*)::bigint AS c FROM dividend_histories`;
        const sample5 = await prisma.$queryRaw<
          { symbol: string; year: number; cagr_5y: number | null }[]
        >`SELECT symbol, year, cagr_5y FROM dividend_histories ORDER BY symbol ASC, year ASC LIMIT 5`;
        const aaplRows = await prisma.$queryRaw<
          { symbol: string; year: number; cagr_5y: number | null }[]
        >`SELECT symbol, year, cagr_5y FROM dividend_histories WHERE symbol = 'AAPL' ORDER BY year ASC`;
        sqlDebug = {
          dividend_histories_count: Number(dhRow?.c ?? 0),
          sample_limit_5: sample5,
          aapl: aaplRows,
        };
      }

      const redisCacheKey = redisKeys.screenerDividendGrowth({ minYears, minYield, limit, offset });
      const screenerDebug = debug
        ? {
            ...(result.debug ?? {
              _warning: "searchGrowthScreener nie zwrócił debug (includeDebug)",
            }),
            redisKeyPrefix: "cache:v1:screener:dividend:growth:v2",
            redisCacheKey,
          }
        : undefined;

      res.json({
        screenerCacheKeyVersion: 2,
        minYears,
        minYield,
        page,
        limit,
        total: result.total,
        count: result.items.length,
        data: result.items,
        ...(screenerDebug ? { screenerDebug } : {}),
        ...(sqlDebug ? { sqlDebug } : {}),
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/intelligence/dividend/comparison/sector", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sectors = await getSectorComparison();
      res.json(sectors);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/intelligence/dividend/:symbol/alerts", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = (req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const body = await getRecentAlerts(symbol, limit);
      res.json(body);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/intelligence/dividend/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = (req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const row = await getDividendIntelligence(symbol);
      if (!row) {
        return res.status(404).json({ error: "Dividend intelligence not found for symbol" });
      }
      res.json(row);
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/api/ai/dividend/sustainability/:symbol",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sym = (req.params.symbol ?? "").trim().toUpperCase();
        if (!sym) return res.status(400).json({ error: "Missing symbol" });

        type CachePayload = {
          symbol: string;
          finalScore: number;
          breakdown: SustainabilityBreakdown;
          lastCalculatedAt: string;
        };

        const cacheKey = redisKeys.sustainabilityDividend(sym);
        const cached = await cacheJsonGet<CachePayload>(cacheKey);
        if (cached !== null) {
          res.json(cached);
          return;
        }

        const row = await getSustainabilityScoreRow(sym);
        if (!row) {
          return res.status(404).json({ error: "Dividend sustainability score not found for symbol" });
        }

        const breakdown = breakdownFromRow(row);
        const payload: CachePayload = {
          symbol: sym,
          finalScore: row.finalScore,
          breakdown,
          lastCalculatedAt: row.lastCalculatedAt.toISOString(),
        };
        await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.SUSTAINABILITY_DIVIDEND);
        res.json(payload);
      } catch (e) {
        next(e);
      }
    },
  );

  app.get("/api/dividends/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = (req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const years = Math.min(30, Math.max(1, parseInt(String(req.query.years ?? "5"), 10) || 5));
      const rows = await getDividendHistory(symbol, years);
      res.json({
        symbol: symbol.toUpperCase(),
        years,
        count: rows.length,
        data: rows.map((r) => ({
          exDate: r.exDate.toISOString(),
          payDate: r.payDate.toISOString(),
          amount: r.amount,
          yield: r.yield,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api]", err);
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({
        error:
          "Database unavailable. Start Postgres (e.g. `docker compose up` in infra/), run `npx prisma db push` in apps/api if needed, and check DATABASE_URL in apps/api/.env.",
      });
    }
    if (isAnalysisConfigurationError(err) && err instanceof Error) {
      return res.status(503).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: message });
  });

  return app;
}

export async function startServer(port?: number): Promise<void> {
  const app = createApp();
  const p = port ?? parseInt(process.env.PORT ?? "3000", 10);
  scheduleDailyDigestJob();
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(p, () => {
      console.log(`HTTP listening on :${p}`);
      resolve();
    });
    server.on("error", reject);
  });
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
const runServerCli = entryFile === thisFile;

if (runServerCli) {
  await import("./load-env");
  const { startTelegramBot, stopTelegramBot } = await import("./telegram/index");
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down…`);
    stopTelegramBot();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  try {
    await startServer();
    await startTelegramBot();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
