import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { analyzeExit } from "../modules/exitIntelligence/exitIntelligence";

export function createExitIntelligenceRouter(): Router {
  const router = Router();

  router.get("/api/paper/exit/:tradeId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tradeId = String(req.params.tradeId ?? "").trim();
      if (!tradeId) return res.status(400).json({ error: "Missing tradeId" });
      const signal = await analyzeExit(tradeId);
      res.json(signal);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
