import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import pino from "pino";
import { prisma } from "../db/index";
import { PortfolioService } from "../services/portfolioService";

type PortfolioDeps = {
  db: typeof prisma;
  portfolioService: PortfolioService;
  getClientIp: (req: Request) => string;
};

type ReqUser = { id?: string } | undefined;

const portfolioLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "portfolio_route" },
});

function defaultClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function buildStats(history: Array<{ pnl_daily: number | null }>): {
  days_active: number;
  best_day_pnl: number;
  worst_day_pnl: number;
  avg_daily_pnl: number;
} {
  const daily = history.map((h) => Number(h.pnl_daily ?? 0));
  if (daily.length === 0) {
    return { days_active: 0, best_day_pnl: 0, worst_day_pnl: 0, avg_daily_pnl: 0 };
  }
  const sum = daily.reduce((a, b) => a + b, 0);
  return {
    days_active: daily.length,
    best_day_pnl: Math.max(...daily),
    worst_day_pnl: Math.min(...daily),
    avg_daily_pnl: Number((sum / daily.length).toFixed(6)),
  };
}

export function createPortfolioRouter(depsInput?: Partial<PortfolioDeps>): Router {
  const db = depsInput?.db ?? prisma;
  const portfolioService = depsInput?.portfolioService ?? new PortfolioService();
  const getClientIp = depsInput?.getClientIp ?? defaultClientIp;

  const router = Router();

  router.get("/api/portfolio/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }

      const ip = getClientIp(req);
      const reqUser = (req as Request & { user?: ReqUser }).user;
      // MVP auth skip: enforce only if req.user is present
      if (reqUser?.id && reqUser.id !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      portfolioLogger.info({ msg: "portfolio_request", ip, userId });

      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const [calc, latestSnapshot, history, trades] = await Promise.all([
        portfolioService.calculatePortfolio(userId),
        db.portfolioSnapshot.findFirst({
          where: { userId },
          orderBy: { date: "desc" },
          select: { benchmark_wig: true, benchmark_sp500: true },
        }),
        portfolioService.getPortfolioHistory(userId, 30),
        db.virtualTrade.findMany({
          where: { userId },
          orderBy: { executed_at: "desc" },
          select: { ticker: true, exchange: true },
        }),
      ]);

      const exchangeByTicker = new Map<string, string>();
      for (const t of trades) {
        if (!exchangeByTicker.has(t.ticker)) exchangeByTicker.set(t.ticker, t.exchange);
      }

      const holdings = Object.entries(calc.holdings).map(([ticker, h]) => {
        const currentPrice = h.qty > 0 ? h.current_value / h.qty : 0;
        const pnlAmount = h.current_value - h.qty * h.avg_price;
        const invested = Math.max(1e-9, h.qty * h.avg_price);
        const pnlPct = (pnlAmount / invested) * 100;
        return {
          ticker,
          exchange: exchangeByTicker.get(ticker) ?? null,
          quantity: h.qty,
          avg_price: h.avg_price,
          current_price: Number(currentPrice.toFixed(6)),
          current_value: h.current_value,
          pnl_amount: Number(pnlAmount.toFixed(6)),
          pnl_pct: Number(pnlPct.toFixed(6)),
        };
      });

      const historyOut = history.map((h) => ({
        date: h.date.toISOString(),
        total_value: h.total_value,
        pnl_daily: h.pnl_daily,
        pnl_total: h.pnl_total,
        benchmark_wig: h.benchmark_wig,
        benchmark_sp500: h.benchmark_sp500,
      }));

      res.json({
        user_id: userId,
        current: {
          total_value: calc.total_value,
          cash: calc.cash,
          holdings,
          total_pnl: calc.total_pnl,
          total_pnl_pct: calc.total_pnl_pct,
          realized_pnl: calc.realized_pnl,
          unrealized_pnl: calc.unrealized_pnl,
        },
        benchmarks: {
          wig: latestSnapshot?.benchmark_wig ?? 0,
          sp500: latestSnapshot?.benchmark_sp500 ?? 0,
        },
        history: historyOut,
        stats: buildStats(history),
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
