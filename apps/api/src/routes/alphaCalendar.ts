import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAlphaWindows, getMarketAlphaCalendar, getTopTickers } from "../modules/alphaCalendar/alphaCalendar";

export function createAlphaCalendarRouter(): Router {
  const router = Router();

  router.get("/api/alpha/windows/:ticker", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const windows = await getAlphaWindows(ticker);
      res.json({ ticker, count: windows.length, windows });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/alpha/calendar", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const top20Tickers = await getTopTickers(20);
      const data = await getMarketAlphaCalendar(top20Tickers);
      res.json({
        generatedAt: new Date().toISOString(),
        tickers: top20Tickers,
        count: data.windows.length,
        topOpportunity: data.topOpportunity,
        aiSummary: data.aiSummary,
        windows: data.windows,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
