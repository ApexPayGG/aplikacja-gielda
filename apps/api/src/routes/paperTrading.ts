import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  closeTrade,
  getCoachSnapshot,
  getPortfolio,
  getTradeHistory,
  openTrade,
} from "../modules/paperTrading/paperTradingModule";
import { sendDiscordClose, sendDiscordOpen } from "../modules/discord/autoSyncModule";

export function createPaperTradingRouter(): Router {
  const router = Router();

  router.post("/api/paper/trade/open", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, ticker, direction, entryPrice, quantity, signalId, stopLoss, takeProfit } = req.body as Record<
        string,
        unknown
      >;
      if (!userId || !ticker || !direction || entryPrice === undefined || quantity === undefined) {
        return res.status(400).json({ error: "Missing required fields: userId, ticker, direction, entryPrice, quantity" });
      }
      if (direction !== "LONG" && direction !== "SHORT") {
        return res.status(400).json({ error: "direction must be LONG or SHORT" });
      }
      const trade = await openTrade(
        String(userId),
        String(ticker),
        direction,
        Number(entryPrice),
        Number(quantity),
        signalId ? String(signalId) : undefined,
      );
      const sl = Number(stopLoss);
      const tp = Number(takeProfit);
      try {
        await sendDiscordOpen({
          userId: String(userId),
          symbol: trade.ticker,
          price: trade.entryPrice,
          stopLoss: Number.isFinite(sl) ? sl : null,
          takeProfit: Number.isFinite(tp) ? tp : null,
        });
      } catch (err) {
        console.error("[discord-auto-sync] open notification failed", err);
      }
      res.json(trade);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/paper/trade/close", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tradeId, exitPrice } = req.body as Record<string, unknown>;
      if (!tradeId || exitPrice === undefined) {
        return res.status(400).json({ error: "Missing required fields: tradeId, exitPrice" });
      }
      const trade = await closeTrade(String(tradeId), Number(exitPrice));
      if (trade.exitAt) {
        try {
          await sendDiscordClose({
            userId: trade.userId,
            symbol: trade.ticker,
            pnlPct: Number(trade.pnlPct ?? 0),
            entryAt: trade.entryAt,
            exitAt: trade.exitAt,
          });
        } catch (err) {
          console.error("[discord-auto-sync] close notification failed", err);
        }
      }
      res.json(trade);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/paper/portfolio/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const data = await getPortfolio(userId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/paper/history/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const data = await getTradeHistory(userId);
      res.json({ count: data.length, data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/paper/coach/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const coach = await getCoachSnapshot(userId);
      res.json(coach);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
