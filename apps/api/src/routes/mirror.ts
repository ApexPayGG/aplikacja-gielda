import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  enableMirrorTrading,
  followMirrorTrader,
  getMirrorPermission,
  listMirrorFollowing,
  listTopMirrorTraders,
  unfollowMirrorTrader,
} from "../modules/mirror/mirrorTradingModule";

export function createMirrorRouter(): Router {
  const router = Router();

  router.get(
    "/api/mirror/permission/:userId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        const data = await getMirrorPermission(userId);
        res.json(data);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/mirror/enable/:userId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        const body = req.body as Record<string, unknown>;
        if (body.revenueShare === undefined || body.revenueShare === null) {
          return res.status(400).json({ error: "Missing revenueShare" });
        }
        const revenueShare = Number(body.revenueShare);
        const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
        const data = await enableMirrorTrading(userId, revenueShare, enabled);
        res.json(data);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/api/mirror/follow", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { followerId, traderId } = req.body as Record<string, unknown>;
      if (!followerId || !traderId) {
        return res.status(400).json({ error: "Missing followerId or traderId" });
      }
      const data = await followMirrorTrader(String(followerId), String(traderId));
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Follow failed";
      if (message.includes("yourself") || message.includes("not accepting")) {
        return res.status(400).json({ error: message });
      }
      next(error);
    }
  });

  router.post("/api/mirror/unfollow", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { followerId, traderId } = req.body as Record<string, unknown>;
      if (!followerId || !traderId) {
        return res.status(400).json({ error: "Missing followerId or traderId" });
      }
      const data = await unfollowMirrorTrader(String(followerId), String(traderId));
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/mirror/top-traders", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const traders = await listTopMirrorTraders();
      res.json({ traders });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/mirror/following/:userId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        const following = await listMirrorFollowing(userId);
        res.json({ following });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
