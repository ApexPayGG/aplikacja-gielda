import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import {
  enqueueInvalidateTickerIntel,
  enqueueRefreshTickerIntel,
} from "./newsSentiment.queue";
import { normalizeNewsSentimentTicker, smartNarrativeCacheService } from "./smartNarrativeCache.service";

type NewsSentimentRouterDeps = {
  cache: Pick<typeof smartNarrativeCacheService, "getFull">;
  enqueueRefresh: typeof enqueueRefreshTickerIntel;
  enqueueInvalidate: typeof enqueueInvalidateTickerIntel;
  db: Pick<PrismaClient, "user">;
  requireAuthMiddleware: RequestHandler;
};

async function requireAdminUser(
  req: Request,
  res: Response,
  db: Pick<PrismaClient, "user">,
): Promise<boolean> {
  const userId = getAuthenticatedUserId(req);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

export function createNewsSentimentRouter(depsInput?: Partial<NewsSentimentRouterDeps>): Router {
  const deps: NewsSentimentRouterDeps = {
    cache: depsInput?.cache ?? smartNarrativeCacheService,
    enqueueRefresh: depsInput?.enqueueRefresh ?? enqueueRefreshTickerIntel,
    enqueueInvalidate: depsInput?.enqueueInvalidate ?? enqueueInvalidateTickerIntel,
    db: depsInput?.db ?? defaultPrisma,
    requireAuthMiddleware: depsInput?.requireAuthMiddleware ?? requireAuth,
  };

  const router = Router();

  router.get("/api/v1/news-sentiment/:ticker", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = normalizeNewsSentimentTicker(String(req.params.ticker ?? ""));
      if (!ticker) {
        res.status(400).json({ error: "Missing ticker" });
        return;
      }

      const cached = await deps.cache.getFull(ticker);
      if (cached) {
        res.json(cached);
        return;
      }

      const jobId = await deps.enqueueRefresh(ticker);
      res.status(202).json({
        ticker,
        queued: true,
        jobId: jobId ?? null,
        message: "Market intel refresh queued",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/v1/news-sentiment/:ticker/refresh",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await requireAdminUser(req, res, deps.db))) return;

        const ticker = normalizeNewsSentimentTicker(String(req.params.ticker ?? ""));
        if (!ticker) {
          res.status(400).json({ error: "Missing ticker" });
          return;
        }

        const jobId = await deps.enqueueRefresh(ticker, { force: true });
        res.status(202).json({
          ticker,
          queued: true,
          jobId: jobId ?? null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/news-sentiment/:ticker/invalidate",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await requireAdminUser(req, res, deps.db))) return;

        const ticker = normalizeNewsSentimentTicker(String(req.params.ticker ?? ""));
        if (!ticker) {
          res.status(400).json({ error: "Missing ticker" });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const reason = String(body.reason ?? "").trim();
        if (!reason) {
          res.status(400).json({ error: "reason is required" });
          return;
        }

        const jobId = await deps.enqueueInvalidate(ticker, reason);
        res.status(202).json({
          ticker,
          queued: true,
          reason,
          jobId: jobId ?? null,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
