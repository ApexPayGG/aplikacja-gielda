import type { NextFunction, Request, Response } from "express";
import express from "express";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { analyzeStock } from "./ai/analysis";
import { getCompaniesBySector, getCompanyBySymbol, searchCompanies } from "./db/company-queries";
import {
  getLatestIndicator,
  getLatestQuote,
  getQuoteHistory,
  getRecentNews,
} from "./db/queries";

export function createApp(): express.Express {
  const app = express();

  app.set("json replacer", (_key: string, value: unknown) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Prisma.Decimal) return value.toString();
    return value;
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "stockai-api", ts: new Date().toISOString() });
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
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
