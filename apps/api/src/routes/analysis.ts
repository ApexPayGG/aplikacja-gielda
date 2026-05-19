import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { analyzeStock } from "../ai/analysis";
import { optionalAuth } from "../modules/auth/authMiddleware";
import { enforceAiBriefFreeRateLimit } from "../services/aiBriefRateLimit";

export type AnalysisRouteDeps = {
  prisma?: PrismaClient;
};

export function createCompanyBriefHandler(deps: AnalysisRouteDeps = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sym = (req.params.symbol ?? "").trim().toUpperCase();
      if (!sym) {
        res.status(400).json({ error: "Missing symbol" });
        return;
      }

      const lang = String(req.query.lang ?? "en").trim() || "en";

      const rate = await enforceAiBriefFreeRateLimit(req, deps.prisma);
      if (!rate.allowed) {
        res.status(429).json({
          error: "LIMIT_REACHED",
          limit: rate.limit,
          resetIn: rate.resetIn,
        });
        return;
      }

      const result = await analyzeStock(sym, lang);
      res.json(result);
    } catch (e) {
      next(e);
    }
  };
}

export function createAnalysisRouter(deps: AnalysisRouteDeps = {}): Router {
  const router = Router();
  const handler = createCompanyBriefHandler(deps);
  router.get("/:symbol", optionalAuth, handler);
  return router;
}
