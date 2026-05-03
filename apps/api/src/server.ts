import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import express from "express";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { analyzeStock } from "./ai/analysis";
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "stockai-api", ts: new Date().toISOString() });
  });

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
      const rows = await searchCompanies(q, limit);
      res.json({ query: q, count: rows.length, data: rows });
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
      const row = await getLatestQuote(req.params.symbol ?? "");
      if (!row) return res.status(404).json({ error: "No quote found" });
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
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
      const rows = await getRecentNews(req.params.symbol ?? "", limit);
      res.json({ symbol: (req.params.symbol ?? "").toUpperCase(), limit, count: rows.length, data: rows });
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
      const result = await analyzeStock(req.params.symbol ?? "");
      res.json(result);
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
