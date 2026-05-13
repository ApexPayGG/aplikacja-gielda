import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  createPostTradeReflection,
  getPostTradeReflections,
} from "../modules/psyche/postTradeReflection";

type ReflectionService = {
  createPostTradeReflection: typeof createPostTradeReflection;
  getPostTradeReflections: typeof getPostTradeReflections;
};

export function createPostTradeReflectionRouter(service?: Partial<ReflectionService>): Router {
  const router = Router();
  const createReflection = service?.createPostTradeReflection ?? createPostTradeReflection;
  const listReflections = service?.getPostTradeReflections ?? getPostTradeReflections;

  router.post("/api/reflection", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      const tradeId = String(body.tradeId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      if (!tradeId) return res.status(400).json({ error: "Missing tradeId" });
      if (typeof body.followedPlan !== "boolean") {
        return res.status(400).json({ error: "followedPlan must be boolean" });
      }

      const result = await createReflection({
        userId,
        tradeId,
        followedPlan: body.followedPlan,
        emotion: body.emotion == null ? null : String(body.emotion),
        lesson: body.lesson == null ? null : String(body.lesson),
      });
      res.json({ reflection: result.reflection, aiInsight: result.aiInsight });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reflection/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const limit = parseInt(String(req.query.limit ?? "10"), 10);
      const result = await listReflections(userId, Number.isFinite(limit) ? limit : 10);
      res.json({ reflections: result.reflections });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
