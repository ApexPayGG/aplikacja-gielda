import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getLossStreakCoolDown } from "../modules/behavioral/lossStreakCoolDown";
import { analyzeMistakesForUser, getMistakeLibrary } from "../modules/behavioral/mistakeLibrary";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

export function createBehavioralRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/api/behavioral/cooldown/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const status = await getLossStreakCoolDown(userId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/behavioral/mistakes/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const data = await getMistakeLibrary(userId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/behavioral/mistakes/:userId/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const result = await analyzeMistakesForUser(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
