import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { requireAuth } from "../modules/auth/authMiddleware";
import {
  createWeeklyReview,
  getCurrentWeeklyReview,
  getWeeklyReviewHistory,
} from "../modules/psyche/weeklyReview";

type WeeklyReviewRouteDeps = {
  createFn: typeof createWeeklyReview;
  getCurrentFn: typeof getCurrentWeeklyReview;
  getHistoryFn: typeof getWeeklyReviewHistory;
};

export function createWeeklyReviewRouter(depsInput?: Partial<WeeklyReviewRouteDeps>): Router {
  const deps: WeeklyReviewRouteDeps = {
    createFn: depsInput?.createFn ?? createWeeklyReview,
    getCurrentFn: depsInput?.getCurrentFn ?? getCurrentWeeklyReview,
    getHistoryFn: depsInput?.getHistoryFn ?? getWeeklyReviewHistory,
  };
  const router = Router();
  router.use("/api/weekly", requireAuth);

  router.get("/api/weekly/current/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const review = await deps.getCurrentFn(userId);
      res.json({ review, hasReview: review != null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/weekly", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const result = await deps.createFn({
        userId,
        q1: body.q1,
        q2: body.q2,
        q3: body.q3,
        q4: body.q4,
        q5: body.q5,
      });
      res.json({ review: result.review, letter: result.letter });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/weekly/history/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const weeks = parseInt(String(req.query.weeks ?? "8"), 10);
      const payload = await deps.getHistoryFn(userId, Number.isFinite(weeks) ? weeks : 8);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
