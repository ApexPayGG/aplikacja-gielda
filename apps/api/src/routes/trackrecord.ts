import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  generateTrackRecord,
  getPublicTrackRecord,
} from "../modules/trackrecord/trackRecordModule";

type TrackRecordRouteDeps = {
  generateFn: typeof generateTrackRecord;
  getPublicFn: typeof getPublicTrackRecord;
};

export function createTrackRecordRouter(depsInput?: Partial<TrackRecordRouteDeps>): Router {
  const deps: TrackRecordRouteDeps = {
    generateFn: depsInput?.generateFn ?? generateTrackRecord,
    getPublicFn: depsInput?.getPublicFn ?? getPublicTrackRecord,
  };

  const router = Router();

  router.post(
    "/api/trackrecord/generate/:userId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        const result = await deps.generateFn(userId);
        res.json({
          publicHash: result.publicHash,
          shareUrl: `stock-ai.pro/track-record/public/${result.publicHash}`,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/trackrecord/public/:hash",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const hash = String(req.params.hash ?? "").trim();
        if (!hash) return res.status(400).json({ error: "Missing hash" });

        const record = await deps.getPublicFn(hash);
        if (!record) return res.status(404).json({ error: "Track record not found" });

        res.json({
          winRate: record.winRate,
          totalTrades: record.totalTrades,
          avgReturn: record.avgReturn,
          bestTradePct: record.bestTradePct,
          worstTradePct: record.worstTradePct,
          generatedAt: record.generatedAt,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
