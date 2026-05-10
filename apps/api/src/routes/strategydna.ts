import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getStrategyDnaMatch } from "../modules/strategydna/strategyDnaModule";

type StrategyDnaRouteDeps = {
  getStrategyDnaFn: typeof getStrategyDnaMatch;
};

export function createStrategyDnaRouter(depsInput?: Partial<StrategyDnaRouteDeps>): Router {
  const deps: StrategyDnaRouteDeps = {
    getStrategyDnaFn: depsInput?.getStrategyDnaFn ?? getStrategyDnaMatch,
  };

  const router = Router();
  router.get("/api/strategydna/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const result = await deps.getStrategyDnaFn(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
