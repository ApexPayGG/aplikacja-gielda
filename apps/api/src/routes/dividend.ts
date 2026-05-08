import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getDividendHealth, getDividendScreener } from "../modules/dividend/dividendModule";

export function createDividendRouter(): Router {
  const router = Router();

  router.get("/api/dividend/screener", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const minYield = req.query.minYield !== undefined ? Number(req.query.minYield) : undefined;
      const maxYield = req.query.maxYield !== undefined ? Number(req.query.maxYield) : undefined;
      const minYears = req.query.minYears !== undefined ? Number(req.query.minYears) : undefined;
      const minHealth = req.query.minHealth !== undefined ? Number(req.query.minHealth) : undefined;
      const trendRaw = String(req.query.trend ?? "").toUpperCase();
      const trend =
        trendRaw === "GROWING" || trendRaw === "STABLE" || trendRaw === "DECLINING"
          ? trendRaw
          : undefined;

      const data = await getDividendScreener({
        minYield: Number.isFinite(minYield ?? NaN) ? minYield : undefined,
        maxYield: Number.isFinite(maxYield ?? NaN) ? maxYield : undefined,
        minYears: Number.isFinite(minYears ?? NaN) ? minYears : undefined,
        minHealth: Number.isFinite(minHealth ?? NaN) ? minHealth : undefined,
        trend,
      });
      res.json({ count: data.length, data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/dividend/:ticker", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim();
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker" });
      }
      const data = await getDividendHealth(ticker);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
