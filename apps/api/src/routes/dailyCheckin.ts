import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  createDailyCheckInIfMissing,
  getDailyCheckInHistory,
  getTodayDailyCheckIn,
} from "../modules/psyche/dailyCheckIn";

export function createDailyCheckinRouter(): Router {
  const router = Router();

  router.get("/api/checkin/today/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const checkin = await getTodayDailyCheckIn(userId);
      res.json({ checkin, hasCheckedIn: checkin != null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/checkin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const result = await createDailyCheckInIfMissing({
        userId,
        mood: body.mood,
        plan: body.plan == null ? null : String(body.plan),
        riskLevel: body.riskLevel == null ? null : String(body.riskLevel),
      });
      res.json({ checkin: result.checkin, aiMessage: result.aiMessage });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/checkin/history/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const days = parseInt(String(req.query.days ?? "30"), 10);
      const payload = await getDailyCheckInHistory(userId, Number.isFinite(days) ? days : 30);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
