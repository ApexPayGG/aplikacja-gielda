import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

type ExportRouteDeps = {
  db: {
    signal: {
      findMany: (args?: unknown) => Promise<
        Array<{
          created_at: Date;
          ticker: string;
          pattern_type: string;
          score: number | null;
          confidence: number;
          win_rate: number | null;
          avg_return_10d: number | null;
          technical_data: unknown;
        }>
      >;
    };
    paperTrade: {
      findMany: (args?: unknown) => Promise<
        Array<{
          entryAt: Date;
          exitAt: Date | null;
          ticker: string;
          entryPrice: number;
          exitPrice: number | null;
          pnl: number | null;
          pnlPct: number | null;
          marketRegime: string | null;
        }>
      >;
    };
    watchlist: {
      findMany: (args?: unknown) => Promise<Array<{ symbol: string }>>;
    };
    company: {
      findMany: (args?: unknown) => Promise<Array<{ symbol: string; name: string }>>;
    };
    dividend: {
      findMany: (args?: unknown) => Promise<
        Array<{
          symbol: string;
          exDate: Date;
          amount: number;
          yield: number | null;
        }>
      >;
    };
    dividendIntelligence: {
      findMany: (args?: unknown) => Promise<Array<{ symbol: string; safetyScore: number }>>;
    };
    dividendSustainabilityScore: {
      findMany: (args?: unknown) => Promise<Array<{ symbol: string; finalScore: number }>>;
    };
  };
  auth: {
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
    getAuthenticatedUserId: (req: Request) => string;
  };
};

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replaceAll('"', '""')}"`;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatIso(date: Date): string {
  return date.toISOString();
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `${value}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `${value}%`;
}

function parseSignalTechnicalLevels(
  technicalData: unknown,
): { entry: string; stopLoss: string; takeProfit: string } {
  if (!technicalData || typeof technicalData !== "object") {
    return { entry: "", stopLoss: "", takeProfit: "" };
  }
  const t = technicalData as Record<string, unknown>;
  const entry = Number(t.entry_price ?? t.entry ?? t.current_price ?? NaN);
  const stopLoss = Number(t.stop_loss ?? t.sl ?? NaN);
  const takeProfit = Number(t.take_profit ?? t.tp ?? NaN);
  return {
    entry: Number.isFinite(entry) ? `${entry}` : "",
    stopLoss: Number.isFinite(stopLoss) ? `${stopLoss}` : "",
    takeProfit: Number.isFinite(takeProfit) ? `${takeProfit}` : "",
  };
}

function durationText(start: Date, end: Date | null): string {
  if (!end) return "";
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function sendCsvResponse(res: Response, baseName: string, csv: string): void {
  const fileDate = formatDay(new Date());
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}-${fileDate}.csv"`);
  res.status(200).send(csv);
}

function validateExportRequest(
  req: Request,
  res: Response,
  getAuthenticatedUserIdFn: (request: Request) => string,
): string | null {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return null;
  }

  const format = String(req.query.format ?? "").trim().toLowerCase();
  if (format !== "csv") {
    res.status(400).json({ error: "Only csv format is supported" });
    return null;
  }

  const authenticatedUserId = getAuthenticatedUserIdFn(req);
  if (authenticatedUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return userId;
}

export function createExportRouter(depsInput?: Partial<ExportRouteDeps>): Router {
  const defaultDb = {
    signal: prisma.signal,
    paperTrade: prisma.paperTrade,
    watchlist: prisma.watchlist,
    company: prisma.company,
    dividend: prisma.dividend,
    dividendIntelligence: prisma.dividendIntelligence,
    dividendSustainabilityScore: prisma.dividendSustainabilityScore,
  } as unknown as ExportRouteDeps["db"];

  const deps: ExportRouteDeps = {
    db: depsInput?.db ?? defaultDb,
    auth: depsInput?.auth ?? {
      requireAuth,
      getAuthenticatedUserId,
    },
  };
  const router = Router();

  router.get("/api/export/signals", deps.auth.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = validateExportRequest(req, res, deps.auth.getAuthenticatedUserId);
      if (!userId) return;
      void userId;

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await deps.db.signal.findMany({
        where: { created_at: { gte: since } },
        orderBy: { created_at: "desc" },
        select: {
          created_at: true,
          ticker: true,
          pattern_type: true,
          score: true,
          confidence: true,
          win_rate: true,
          avg_return_10d: true,
          technical_data: true,
        },
      });

      const csvRows = rows.map((row) => {
        const levels = parseSignalTechnicalLevels(row.technical_data);
        const result = row.avg_return_10d != null ? formatPercent(row.avg_return_10d) : formatPercent(row.win_rate);
        return [
          formatIso(row.created_at),
          row.ticker,
          row.pattern_type,
          formatNumber(row.score ?? row.confidence),
          levels.entry,
          levels.stopLoss,
          levels.takeProfit,
          result,
        ];
      });

      const csv = buildCsv(["Date", "Ticker", "Setup", "Score", "Entry", "SL", "TP", "Result"], csvRows);
      sendCsvResponse(res, "signals", csv);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/export/portfolio", deps.auth.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = validateExportRequest(req, res, deps.auth.getAuthenticatedUserId);
      if (!userId) return;

      const rows = await deps.db.paperTrade.findMany({
        where: { userId },
        orderBy: { entryAt: "desc" },
        select: {
          entryAt: true,
          exitAt: true,
          ticker: true,
          entryPrice: true,
          exitPrice: true,
          pnl: true,
          pnlPct: true,
          marketRegime: true,
        },
      });

      const csvRows = rows.map((row) => [
        formatIso(row.entryAt),
        row.ticker,
        formatNumber(row.entryPrice),
        formatNumber(row.exitPrice),
        formatNumber(row.pnl),
        formatPercent(row.pnlPct),
        durationText(row.entryAt, row.exitAt),
        row.marketRegime ?? "",
      ]);

      const csv = buildCsv(["Date", "Ticker", "Entry", "Exit", "PnL", "PnL%", "Duration", "Notes"], csvRows);
      sendCsvResponse(res, "portfolio", csv);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/export/dividend", deps.auth.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = validateExportRequest(req, res, deps.auth.getAuthenticatedUserId);
      if (!userId) return;

      const watchlist = await deps.db.watchlist.findMany({
        where: { userId },
        orderBy: { addedAt: "desc" },
        select: { symbol: true },
      });
      const symbols = Array.from(new Set(watchlist.map((row) => row.symbol)));

      if (symbols.length === 0) {
        const csv = buildCsv(["Ticker", "Name", "Yield", "HealthScore", "ExDate", "DividendPerShare"], []);
        sendCsvResponse(res, "dividend", csv);
        return;
      }

      const [companies, dividends, intelligence, sustainability] = await Promise.all([
        deps.db.company.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, name: true },
        }),
        deps.db.dividend.findMany({
          where: { symbol: { in: symbols } },
          orderBy: [{ symbol: "asc" }, { exDate: "desc" }],
          select: { symbol: true, exDate: true, amount: true, yield: true },
        }),
        deps.db.dividendIntelligence.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, safetyScore: true },
        }),
        deps.db.dividendSustainabilityScore.findMany({
          where: { symbol: { in: symbols } },
          select: { symbol: true, finalScore: true },
        }),
      ]);

      const companyBySymbol = new Map(companies.map((row) => [row.symbol, row.name]));
      const dividendBySymbol = new Map<string, (typeof dividends)[number]>();
      for (const row of dividends) {
        if (!dividendBySymbol.has(row.symbol)) {
          dividendBySymbol.set(row.symbol, row);
        }
      }
      const intelligenceBySymbol = new Map(intelligence.map((row) => [row.symbol, row.safetyScore]));
      const sustainabilityBySymbol = new Map(sustainability.map((row) => [row.symbol, row.finalScore]));

      const csvRows = symbols.map((symbol) => {
        const dividend = dividendBySymbol.get(symbol);
        const healthScore = intelligenceBySymbol.get(symbol) ?? sustainabilityBySymbol.get(symbol) ?? null;
        return [
          symbol,
          companyBySymbol.get(symbol) ?? symbol,
          formatPercent(dividend?.yield),
          formatNumber(healthScore),
          dividend ? formatDay(dividend.exDate) : "",
          formatNumber(dividend?.amount),
        ];
      });

      const csv = buildCsv(["Ticker", "Name", "Yield", "HealthScore", "ExDate", "DividendPerShare"], csvRows);
      sendCsvResponse(res, "dividend", csv);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
