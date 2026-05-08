import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAlphaJournalEvents } from "../services/alphaJournalService";

export function createAlphaJournalRouter(): Router {
  const router = Router();

  router.get("/api/alpha/journal", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
      const events = await getAlphaJournalEvents(limit);
      res.json({
        generatedAt: new Date().toISOString(),
        count: events.length,
        events,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
