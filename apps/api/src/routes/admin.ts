import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

type Tier = "FREE" | "PRO" | "PRO_PLUS";

type AdminRouteDeps = {
  db: {
    user: {
      findUnique: (args: {
        where: { id: string };
        select: { role: true };
      }) => Promise<{ role: string } | null>;
      count: (args?: { where?: { tier?: string; createdAt?: { gte: Date } } }) => Promise<number>;
      findMany: (args: {
        skip: number;
        take: number;
        orderBy: { createdAt: "desc" };
        select: {
          id: true;
          email: true;
          tier: true;
          createdAt: true;
          lastLoginAt: true;
        };
      }) => Promise<
        Array<{
          id: string;
          email: string;
          tier: string;
          createdAt: Date;
          lastLoginAt: Date | null;
        }>
      >;
      update: (args: {
        where: { id: string };
        data: { tier: Tier };
        select: {
          id: true;
          email: true;
          tier: true;
          createdAt: true;
          lastLoginAt: true;
        };
      }) => Promise<{
        id: string;
        email: string;
        tier: string;
        createdAt: Date;
        lastLoginAt: Date | null;
      }>;
    };
    signal: { count: () => Promise<number> };
    virtualTrade: { count: () => Promise<number> };
    paperTrade: { count: () => Promise<number> };
    affiliateClick: { count: () => Promise<number> };
    affiliateConversion: { count: () => Promise<number> };
    dlqEvent: {
      findMany: (args: {
        orderBy: { createdAt: "desc" };
        take: number;
        select: {
          id: true;
          jobId: true;
          ticker: true;
          attempt: true;
          status: true;
          createdAt: true;
        };
      }) => Promise<
        Array<{
          id: number;
          jobId: string;
          ticker: string;
          attempt: number;
          status: string;
          createdAt: Date;
        }>
      >;
    };
  };
  requireAuthMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  now: () => Date;
};

const ALLOWED_TIERS = new Set<Tier>(["FREE", "PRO", "PRO_PLUS"]);

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parsePagination(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function createAdminRouter(inputDeps?: Partial<AdminRouteDeps>): Router {
  const deps: AdminRouteDeps = {
    db: inputDeps?.db ?? prisma,
    requireAuthMiddleware: inputDeps?.requireAuthMiddleware ?? requireAuth,
    now: inputDeps?.now ?? (() => new Date()),
  };

  const router = Router();
  router.use("/api/admin", deps.requireAuthMiddleware);
  router.use("/api/admin", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await deps.db.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user || user.role !== "ADMIN") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/admin/stats", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = deps.now();
      const startToday = startOfUtcDay(now);
      const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [
        totalUsers,
        freeUsers,
        proUsers,
        proPlusUsers,
        newUsersToday,
        newUsersThisWeek,
        totalSignals,
        totalVirtualTrades,
        totalPaperTrades,
        affiliateClicks,
        affiliateConversions,
      ] = await Promise.all([
        deps.db.user.count(),
        deps.db.user.count({ where: { tier: "FREE" } }),
        deps.db.user.count({ where: { tier: "PRO" } }),
        deps.db.user.count({ where: { tier: "PRO_PLUS" } }),
        deps.db.user.count({ where: { createdAt: { gte: startToday } } }),
        deps.db.user.count({ where: { createdAt: { gte: startWeek } } }),
        deps.db.signal.count(),
        deps.db.virtualTrade.count(),
        deps.db.paperTrade.count(),
        deps.db.affiliateClick.count(),
        deps.db.affiliateConversion.count(),
      ]);

      res.json({
        totalUsers,
        freeUsers,
        proUsers,
        proPlusUsers,
        newUsersToday,
        newUsersThisWeek,
        totalSignals,
        totalTrades: totalVirtualTrades + totalPaperTrades,
        affiliateClicks,
        affiliateConversions,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/admin/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parsePagination(req.query.page, 1, 1, 10_000);
      const limit = parsePagination(req.query.limit, 20, 1, 100);
      const skip = (page - 1) * limit;

      const [total, users] = await Promise.all([
        deps.db.user.count(),
        deps.db.user.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            tier: true,
            createdAt: true,
            lastLoginAt: true,
          },
        }),
      ]);

      res.json({
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          tier: user.tier,
          createdAt: user.createdAt,
          lastLogin: user.lastLoginAt,
        })),
        page,
        limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/admin/user/:id/tier", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.id ?? "").trim();
      const body = req.body as Record<string, unknown>;
      const tierInput = String(body.tier ?? "")
        .trim()
        .toUpperCase() as Tier;
      if (!userId) {
        res.status(400).json({ error: "Missing user id" });
        return;
      }
      if (!ALLOWED_TIERS.has(tierInput)) {
        res.status(400).json({ error: "Invalid tier" });
        return;
      }

      const user = await deps.db.user.update({
        where: { id: userId },
        data: { tier: tierInput },
        select: {
          id: true,
          email: true,
          tier: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          tier: user.tier,
          createdAt: user.createdAt,
          lastLogin: user.lastLoginAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      next(error);
    }
  });

  router.get("/api/admin/errors", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await deps.db.dlqEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          jobId: true,
          ticker: true,
          attempt: true,
          status: true,
          createdAt: true,
        },
      });
      res.json({ errors: rows });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
