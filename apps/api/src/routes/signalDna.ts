import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getSignalDnaSummary } from "../modules/signalDna/signalDna";

export function createSignalDnaRouter(): Router {
  const router = Router();

  router.get("/api/signals/:signalId/dna", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signalId = String(req.params.signalId ?? "").trim();
      if (!signalId) return res.status(400).json({ error: "Missing signalId" });
      const summary = await getSignalDnaSummary(signalId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
