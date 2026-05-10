import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  analyzeCorrelations,
  type CorrelationAnalyzeResult,
} from "../modules/correlation/correlationModule";

type CorrelationRouteDeps = {
  analyzeFn: (symbol: string, portfolio: string[]) => Promise<CorrelationAnalyzeResult>;
};

export function createCorrelationRouter(depsInput?: Partial<CorrelationRouteDeps>): Router {
  const deps: CorrelationRouteDeps = {
    analyzeFn: depsInput?.analyzeFn ?? analyzeCorrelations,
  };
  const router = Router();

  router.post("/api/correlation/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { symbol?: unknown; portfolio?: unknown };
      const symbol = String(body?.symbol ?? "")
        .trim()
        .toUpperCase();
      const portfolio = Array.isArray(body?.portfolio)
        ? body.portfolio.map((item) => String(item ?? ""))
        : null;

      if (!symbol || !portfolio) {
        return res.status(400).json({ error: "Body must include { symbol, portfolio: string[] }" });
      }

      const result = await deps.analyzeFn(symbol, portfolio);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
