import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  closeTrade,
  getCoachSnapshot,
  getPortfolio,
  getTradeHistory,
  openTrade,
} from "../modules/paperTrading/paperTradingModule";
import {
  createDecisionReceipt,
  DECISION_RECEIPT_KIND,
  listDecisionReceipts,
} from "../modules/paperTrading/decisionReceiptModule";
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

  router.post("/api/paper/decision-receipt", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      const kind = String(body.kind ?? "").trim();
      const symbol = String(body.symbol ?? "").trim();
      const paperTradeId = body.paperTradeId != null && body.paperTradeId !== "" ? String(body.paperTradeId) : null;
      const payload = body.payload;

      if (!userId) return res.status(400).json({ error: "Missing userId" });
      if (kind !== DECISION_RECEIPT_KIND.PROCEED_PREMORTEM && kind !== DECISION_RECEIPT_KIND.CLOSED_LOSS) {
        return res.status(400).json({ error: "Invalid kind" });
      }
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      if (payload === undefined || payload === null || typeof payload !== "object") {
        return res.status(400).json({ error: "payload must be a JSON object" });
      }
      if (kind === DECISION_RECEIPT_KIND.PROCEED_PREMORTEM && !paperTradeId) {
        return res.status(400).json({ error: "paperTradeId required for PROCEED_PREMORTEM" });
      }
      if (kind === DECISION_RECEIPT_KIND.CLOSED_LOSS && !paperTradeId) {
        return res.status(400).json({ error: "paperTradeId required for CLOSED_LOSS" });
      }

      const row = await createDecisionReceipt({
        userId,
        paperTradeId,
        kind,
        symbol,
        payload: payload as Prisma.InputJsonValue,
      });
      res.status(201).json(row);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/paper/decision-receipts/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const take = Math.min(100, Math.max(1, parseInt(String(req.query.take ?? "40"), 10) || 40));
      const receipts = await listDecisionReceipts(userId, take);
      res.json({
        receipts: receipts.map((r) => ({
          id: r.id,
          userId: r.userId,
          paperTradeId: r.paperTradeId,
          kind: r.kind,
          symbol: r.symbol,
          payload: r.payload,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
