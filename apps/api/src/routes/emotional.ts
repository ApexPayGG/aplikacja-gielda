import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import {
  getEmotionalStatus,
  suggestCalmingBreak,
  trackEmotionalState,
  type EmotionalTrackInput,
} from "../modules/behavioral/emotionalStateDetector";

type EmotionalTrackDeps = NonNullable<Parameters<typeof trackEmotionalState>[1]>;
type DbLike = NonNullable<EmotionalTrackDeps["db"]>;

function toFinite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function createEmotionalRouter(
  deps?: {
    db?: DbLike;
    suggestor?: EmotionalTrackDeps["suggestor"];
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
        { db, suggestor } as EmotionalTrackDeps,
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
      const status = await getEmotionalStatus(
        userId,
        ({ db } as unknown) as Parameters<typeof getEmotionalStatus>[1],
      );
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
