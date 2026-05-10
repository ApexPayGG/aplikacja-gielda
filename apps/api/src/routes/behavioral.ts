import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getLossStreakCoolDown } from "../modules/behavioral/lossStreakCoolDown";

export function createBehavioralRouter(): Router {
  const router = Router();

  router.get("/api/behavioral/cooldown/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const status = await getLossStreakCoolDown(userId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
