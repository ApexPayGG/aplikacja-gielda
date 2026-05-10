import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  predictEarningsSurprise,
  type EarningsPredictionResult,
} from "../modules/earnings/earningsPredictorModule";

type EarningsRouteDeps = {
  predictFn: (symbol: string) => Promise<EarningsPredictionResult>;
};

export function createEarningsRouter(depsInput?: Partial<EarningsRouteDeps>): Router {
  const deps: EarningsRouteDeps = {
    predictFn: depsInput?.predictFn ?? predictEarningsSurprise,
  };

  const router = Router();
  router.get("/api/earnings/predict/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = String(req.params.symbol ?? "").trim().toUpperCase();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const result = await deps.predictFn(symbol);
      res.json({
        symbol: result.symbol,
        prediction: result.prediction,
        confidence: result.confidence,
        reasoning: result.reasoning,
        nextEarningsDate: result.nextEarningsDate,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
