import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

function normalizeSymbol(symbolRaw: unknown): string {
  return String(symbolRaw ?? "").trim().toUpperCase();
}

export function createWatchlistRouter(): Router {
  const router = Router();

  router.get("/api/watchlist/:userId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }

      if (getAuthenticatedUserId(req) !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const rows = await prisma.watchlist.findMany({
        where: { userId },
        orderBy: { addedAt: "desc" },
      });
      res.json({ items: rows });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/watchlist", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      const symbol = normalizeSymbol(body.symbol);

      if (!userId || !symbol) {
        res.status(400).json({ error: "Missing userId or symbol" });
        return;
      }

      if (getAuthenticatedUserId(req) !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const created = await prisma.watchlist.create({
        data: {
          userId,
          symbol,
        },
      });

      res.status(201).json(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const body = req.body as Record<string, unknown>;
        const userId = String(body.userId ?? "").trim();
        const symbol = normalizeSymbol(body.symbol);
        const existing = await prisma.watchlist.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol,
            },
          },
        });
        if (existing) {
          res.status(200).json(existing);
          return;
        }
      }
      next(error);
    }
  });

  router.delete(
    "/api/watchlist/:userId/:symbol",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        const symbol = normalizeSymbol(req.params.symbol);

        if (!userId || !symbol) {
          res.status(400).json({ error: "Missing userId or symbol" });
          return;
        }

        if (getAuthenticatedUserId(req) !== userId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const removed = await prisma.watchlist.deleteMany({
          where: {
            userId,
            symbol,
          },
        });

        res.json({ deleted: removed.count > 0 });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
