import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { analyzeStock, type AnalyzeStockContext } from "../ai/analysis";
import { BriefGenerationBusyError } from "../services/aiBriefCache";
import { getRequestPath, resolveUserTier } from "../services/aiBriefRateLimit";
import { optionalAuth, tryGetAuthenticatedUserId } from "../modules/auth/authMiddleware";

export type AnalysisRouteDeps = {
  prisma?: PrismaClient;
};

async function buildAnalyzeContext(req: Request, prisma?: PrismaClient): Promise<AnalyzeStockContext> {
  const userId = tryGetAuthenticatedUserId(req);
  const tier = await resolveUserTier(req, prisma);
  return {
    userId,
    plan: tier,
    endpoint: getRequestPath(req),
    clientIp: req.ip || req.socket?.remoteAddress || null,
  };
}

export function createCompanyBriefHandler(deps: AnalysisRouteDeps = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sym = (req.params.symbol ?? "").trim().toUpperCase();
      if (!sym) {
        res.status(400).json({ error: "Missing symbol" });
        return;
      }

      const lang = String(req.query.lang ?? "en").trim() || "en";
      const ctx = await buildAnalyzeContext(req, deps.prisma);
      const result = await analyzeStock(sym, lang, ctx);
      res.json(result);
    } catch (e) {
      if (e instanceof BriefGenerationBusyError) {
        res.status(503).json({
          error: "BRIEF_GENERATION_BUSY",
          message: "Brief is being generated for this symbol. Retry in a few seconds.",
          symbol: e.symbol,
          lang: e.lang,
          retryAfterSec: 5,
        });
        return;
      }
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
