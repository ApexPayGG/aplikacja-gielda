import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  evaluateReplayDecision,
  getReplaySnapshot,
  type ReplayAction,
} from "../modules/replay/replayModule";

type ReplayRouteDeps = {
  getSnapshotFn: typeof getReplaySnapshot;
  evaluateFn: typeof evaluateReplayDecision;
};

export function createReplayRouter(depsInput?: Partial<ReplayRouteDeps>): Router {
  const deps: ReplayRouteDeps = {
    getSnapshotFn: depsInput?.getSnapshotFn ?? getReplaySnapshot,
    evaluateFn: depsInput?.evaluateFn ?? evaluateReplayDecision,
  };

  const router = Router();

  router.get("/api/replay/snapshot", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = String(req.query.symbol ?? "").trim().toUpperCase();
      const date = String(req.query.date ?? "").trim();
      if (!symbol || !date) {
        return res.status(400).json({ error: "Missing required query params: symbol, date" });
      }
      const snapshot = await deps.getSnapshotFn(symbol, date);
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/replay/evaluate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, symbol, date, action, price } = req.body as Record<string, unknown>;
      if (!userId || !symbol || !date || !action || price === undefined) {
        return res
          .status(400)
          .json({ error: "Missing required fields: userId, symbol, date, action, price" });
      }
      if (action !== "BUY" && action !== "SELL") {
        return res.status(400).json({ error: "action must be BUY or SELL" });
      }

      const result = await deps.evaluateFn({
        userId: String(userId),
        symbol: String(symbol),
        date: String(date),
        action: action as ReplayAction,
        price: Number(price),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
