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
    affiliateClick: {
      count: (args?: { where?: { clickedAt?: { gte: Date } } }) => Promise<number>;
      groupBy: (args: {
        by: Array<"brokerId" | "language" | "sourcePage">;
        where?: { clickedAt?: { gte: Date } };
        _count: { _all: true };
      }) => Promise<
        Array<{
          brokerId?: string | null;
          language?: string | null;
          sourcePage?: string | null;
          _count: { _all: number };
        }>
      >;
      findMany: (args: {
        skip: number;
        take: number;
        orderBy: { clickedAt: "desc" };
        where?: { clickedAt?: { gte: Date } };
        select: {
          id: true;
          language: true;
          sourcePage: true;
          clickedAt: true;
          broker: { select: { slug: true } };
        };
      }) => Promise<
        Array<{
          id: string;
          language: string | null;
          sourcePage: string | null;
          clickedAt: Date;
          broker: { slug: string } | null;
        }>
      >;
    };
    affiliateConversion: { count: () => Promise<number> };
    affiliateBroker: {
      findMany: (args: {
        where: { id: { in: string[] } };
        select: { id: true; slug: true };
      }) => Promise<Array<{ id: string; slug: string }>>;
    };
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

function dateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recordFromGroupedRows(
  rows: Array<{
    key: string;
    count: number;
  }>,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.key] = row.count;
    return acc;
  }, {});
}

export function createAdminRouter(inputDeps?: Partial<AdminRouteDeps>): Router {
  const deps: AdminRouteDeps = {
    db: inputDeps?.db ?? (prisma as unknown as AdminRouteDeps["db"]),
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

  router.get("/api/admin/affiliate/stats", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = deps.now();
      const todayStart = startOfUtcDay(now);
      const startOfLast7Days = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startOfLast30Days = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);

      const [
        totalClicks,
        clicksLast30Days,
        brokerCountsRaw,
        langCountsRaw,
        pageCountsRaw,
        clicksLast7Rows,
      ] = await Promise.all([
        deps.db.affiliateClick.count(),
        deps.db.affiliateClick.count({ where: { clickedAt: { gte: startOfLast30Days } } }),
        deps.db.affiliateClick.groupBy({
          by: ["brokerId"],
          _count: { _all: true },
        }),
        deps.db.affiliateClick.groupBy({
          by: ["language"],
          _count: { _all: true },
        }),
        deps.db.affiliateClick.groupBy({
          by: ["sourcePage"],
          _count: { _all: true },
        }),
        deps.db.affiliateClick.findMany({
          skip: 0,
          take: 100_000,
          where: { clickedAt: { gte: startOfLast7Days } },
          orderBy: { clickedAt: "desc" },
          select: {
            id: true,
            language: true,
            sourcePage: true,
            clickedAt: true,
            broker: { select: { slug: true } },
          },
        }),
      ]);

      const brokerIds = brokerCountsRaw
        .map((row) => row.brokerId)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const brokerRows =
        brokerIds.length > 0
          ? await deps.db.affiliateBroker.findMany({
              where: { id: { in: brokerIds } },
              select: { id: true, slug: true },
            })
          : [];
      const brokerMap = new Map(brokerRows.map((broker) => [broker.id, broker.slug]));

      const clicksByBroker = recordFromGroupedRows(
        brokerCountsRaw.map((row) => ({
          key: brokerMap.get(row.brokerId ?? "") ?? "unknown",
          count: row._count._all,
        })),
      );
      const clicksByLang = recordFromGroupedRows(
        langCountsRaw.map((row) => ({
          key: (row.language ?? "unknown").toLowerCase(),
          count: row._count._all,
        })),
      );
      const clicksByPage = recordFromGroupedRows(
        pageCountsRaw.map((row) => ({
          key: (row.sourcePage ?? "unknown").toLowerCase(),
          count: row._count._all,
        })),
      );

      const dailyMap = new Map<string, number>();
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(startOfLast7Days.getTime() + i * 24 * 60 * 60 * 1000);
        dailyMap.set(dateKeyUtc(date), 0);
      }
      for (const row of clicksLast7Rows) {
        const key = dateKeyUtc(row.clickedAt);
        if (!dailyMap.has(key)) continue;
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
      const clicksLast7Days = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

      res.json({
        totalClicks,
        clicksByBroker,
        clicksByLang,
        clicksByPage,
        clicksLast7Days,
        clicksLast30Days,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/admin/affiliate/clicks", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parsePagination(req.query.page, 1, 1, 10_000);
      const limit = parsePagination(req.query.limit, 20, 1, 100);
      const skip = (page - 1) * limit;

      const [total, clicks] = await Promise.all([
        deps.db.affiliateClick.count(),
        deps.db.affiliateClick.findMany({
          skip,
          take: limit,
          orderBy: { clickedAt: "desc" },
          select: {
            id: true,
            language: true,
            sourcePage: true,
            clickedAt: true,
            broker: { select: { slug: true } },
          },
        }),
      ]);

      res.json({
        page,
        limit,
        total,
        clicks: clicks.map((row) => ({
          id: row.id,
          broker: row.broker?.slug ?? "unknown",
          lang: row.language ?? "unknown",
          page: row.sourcePage ?? "unknown",
          createdAt: row.clickedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
