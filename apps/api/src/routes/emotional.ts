import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import {
  getEmotionalStatus,
  suggestCalmingBreak,
  trackEmotionalState,
  type EmotionalTrackInput,
} from "../modules/behavioral/emotionalStateDetector";

type DbLike = {
  emotionalEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findFirst: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

function toFinite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function createEmotionalRouter(
  deps?: {
    db?: DbLike;
    suggestor?: (payload: EmotionalTrackInput) => Promise<string>;
  },
): Router {
  const db = (deps?.db ?? (prisma as unknown as DbLike)) as DbLike;
  const suggestor = deps?.suggestor ?? suggestCalmingBreak;
  const router = Router();

  router.post("/api/emotional/track", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.body?.userId ?? "").trim();
      const clickRate = toFinite(req.body?.clickRate);
      const tradeFrequency = toFinite(req.body?.tradeFrequency);
      const avgDecisionTime = toFinite(req.body?.avgDecisionTime);

      if (!userId || clickRate == null || tradeFrequency == null || avgDecisionTime == null) {
        return res.status(400).json({
          error: "Body must include: userId, clickRate, tradeFrequency, avgDecisionTime",
        });
      }

      const result = await trackEmotionalState(
        {
          userId,
          clickRate,
          tradeFrequency,
          avgDecisionTime,
        },
        { db, suggestor },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/emotional/status/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const status = await getEmotionalStatus(userId, { db });
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
