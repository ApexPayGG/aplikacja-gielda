import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { findSimilarHistoricalSetups } from "../modules/reversescreener/reverseScreenerModule";

export function createReverseScreenerRouter(): Router {
  const router = Router();

  router.post("/api/reversescreener/find", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as { symbol?: string; date?: string };
      const symbol = String(body.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const date = body.date != null && String(body.date).trim() !== "" ? String(body.date).trim() : undefined;
      const result = await findSimilarHistoricalSetups(symbol, date);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
