import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import {
  runWalkForwardBacktest,
  type WalkForwardStrategy,
} from "../modules/backtest/walkForwardModule";

const PATTERN_WHITELIST = new Set(["breakout", "support_bounce", "macd_cross", "bollinger"]);
const EXCHANGE_WHITELIST = new Set(["GPW", "NYSE"]);

const WALK_FORWARD_STRATEGIES = new Set<WalkForwardStrategy>([
  "RSI_OVERSOLD",
  "BREAKOUT",
  "VOLUME_SPIKE",
]);
const WALK_FORWARD_MONTHS = new Set([3, 6, 12]);

interface TradeResult {
  date: string;
  ticker: string;
  return_pct: number;
  outcome: "WIN" | "LOSS";
}

function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function calculateMaxDrawdown(equityCurve: Array<{ date: string; value: number }>): number {
  if (equityCurve.length === 0) return 0;
  let peak = equityCurve[0]?.value ?? 0;
  let maxDd = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    if (peak > 0) {
      const dd = ((peak - point.value) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return Number(maxDd.toFixed(4));
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function createBacktestRouter(): Router {
  const router = Router();

  router.post("/api/backtest/run", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        symbol?: unknown;
        strategy?: unknown;
        months?: unknown;
      };
      const symbol = String(body.symbol ?? "").trim();
      const strategyRaw = String(body.strategy ?? "").trim();
      const months = parseInt(String(body.months ?? ""), 10);

      if (!symbol) {
        res.status(400).json({ error: "Missing symbol" });
        return;
      }
      if (!WALK_FORWARD_STRATEGIES.has(strategyRaw as WalkForwardStrategy)) {
        res.status(400).json({ error: "Invalid strategy. Use RSI_OVERSOLD | BREAKOUT | VOLUME_SPIKE" });
        return;
      }
      const strategy = strategyRaw as WalkForwardStrategy;
      if (!Number.isFinite(months) || !WALK_FORWARD_MONTHS.has(months)) {
        res.status(400).json({ error: "Invalid months. Allowed: 3 | 6 | 12" });
        return;
      }

      const result = await runWalkForwardBacktest(prisma, {
        symbol,
        strategy,
        months,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/backtest", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        pattern?: unknown;
        start_date?: unknown;
        exchange?: unknown;
      };
      const pattern = String(body.pattern ?? "").trim();
      const startDateStr = String(body.start_date ?? "").trim();
      const exchange = body.exchange ? String(body.exchange).trim().toUpperCase() : undefined;

      if (!PATTERN_WHITELIST.has(pattern)) {
        res.status(400).json({ error: "Invalid pattern" });
        return;
      }
      if (!isValidDateString(startDateStr)) {
        res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        return;
      }
      if (exchange && !EXCHANGE_WHITELIST.has(exchange)) {
        res.status(400).json({ error: "Invalid exchange. Allowed: GPW | NYSE" });
        return;
      }

      const startDate = new Date(`${startDateStr}T00:00:00.000Z`);

      const signals = await prisma.signal.findMany({
        where: {
          pattern_type: pattern,
          created_at: { gte: startDate },
          ...(exchange ? { exchange } : {}),
        },
        orderBy: { created_at: "asc" },
        select: { id: true, ticker: true, created_at: true },
      });

      const trades: TradeResult[] = [];
      const returns: number[] = [];

      for (const s of signals) {
        const bars = await prisma.quote.findMany({
          where: { symbol: s.ticker, timestamp: { gte: s.created_at } },
          orderBy: { timestamp: "asc" },
          take: 21,
          select: { timestamp: true, close: true },
        });
        if (bars.length < 2) continue;
        const first = Number(bars[0]?.close ?? 0);
        const last = Number((bars[Math.min(20, bars.length - 1)]?.close ?? 0) as unknown as number);
        if (first <= 0) continue;
        const retPct = ((last - first) / first) * 100;
        returns.push(retPct);
        trades.push({
          date: s.created_at.toISOString(),
          ticker: s.ticker,
          return_pct: Number(retPct.toFixed(4)),
          outcome: retPct > 0 ? "WIN" : "LOSS",
        });
      }

      const totalSignals = trades.length;
      const winCount = trades.filter((t) => t.outcome === "WIN").length;
      const lossCount = totalSignals - winCount;
      const winRate = totalSignals > 0 ? (winCount / totalSignals) * 100 : 0;
      const avgReturn = totalSignals > 0 ? returns.reduce((a, b) => a + b, 0) / totalSignals : 0;
      const maxReturn = totalSignals > 0 ? Math.max(...returns) : 0;
      const minReturn = totalSignals > 0 ? Math.min(...returns) : 0;
      const returnStd = stdDev(returns);
      const sharpeLike = returnStd > 0 ? avgReturn / returnStd : 0;
      const consistencyScore = totalSignals > 0 ? (winRate * 0.7 + Math.max(0, avgReturn) * 3) / 1.3 : 0;

      // Equity curve: invest 1% of current capital per signal
      let capital = 10_000;
      const equityCurve: Array<{ date: string; value: number }> = [
        { date: startDate.toISOString().slice(0, 10), value: Number(capital.toFixed(4)) },
      ];
      for (const t of trades) {
        const invest = capital * 0.01;
        capital += invest * (t.return_pct / 100);
        equityCurve.push({ date: t.date.slice(0, 10), value: Number(capital.toFixed(4)) });
      }
      equityCurve.sort((a, b) => a.date.localeCompare(b.date));
      const maxDrawdown = calculateMaxDrawdown(equityCurve);

      res.json({
        pattern,
        period: {
          start_date: startDateStr,
          end_date: new Date().toISOString().slice(0, 10),
        },
        total_signals: totalSignals,
        win_count: winCount,
        loss_count: lossCount,
        win_rate: Number(winRate.toFixed(4)),
        avg_return: Number(avgReturn.toFixed(4)),
        max_return: Number(maxReturn.toFixed(4)),
        min_return: Number(minReturn.toFixed(4)),
        max_drawdown: Number(maxDrawdown.toFixed(4)),
        sharpe_like: Number(sharpeLike.toFixed(4)),
        consistency_score: Number(Math.max(0, Math.min(100, consistencyScore)).toFixed(4)),
        equity_curve: equityCurve,
        trades,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
