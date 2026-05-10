import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { analyzePreMortem } from "../modules/premortem/preMortemModule";

export function createPreMortemRouter(): Router {
  const router = Router();

  router.post("/api/premortem/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { symbol, entry, stopLoss, takeProfit, quantity, userId } = req.body as Record<string, unknown>;
      if (!symbol || entry === undefined || stopLoss === undefined || takeProfit === undefined || quantity === undefined || !userId) {
        return res.status(400).json({ error: "Missing required fields: symbol, entry, stopLoss, takeProfit, quantity, userId" });
      }

      const result = await analyzePreMortem({
        symbol: String(symbol),
        entry: Number(entry),
        stopLoss: Number(stopLoss),
        takeProfit: Number(takeProfit),
        quantity: Number(quantity),
        userId: String(userId),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
