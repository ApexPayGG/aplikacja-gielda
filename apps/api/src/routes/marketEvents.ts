import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";
import { isMarketEventsEnabled } from "../modules/marketEvents/config";
import {
  buildWatchlistDailyDigest,
  defaultEventSubscription,
  listMarketEvents,
  listWatchlistMarketEvents,
  upsertDefaultSubscription,
} from "../modules/marketEvents/marketEventsService";
import type { EventImportance, MarketEventType } from "../modules/marketEvents/types";

export type MarketEventsRouteDeps = {
  prisma?: PrismaClient;
};

function disabled(_req: Request, res: Response): void {
  res.status(503).json({
    error: "MARKET_EVENTS_DISABLED",
    message: "Market Events Intelligence is disabled (MARKET_EVENTS_ENABLED=0).",
  });
}

function guardEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isMarketEventsEnabled()) {
    disabled(req, res);
    return;
  }
  next();
}

export function createMarketEventsRouter(deps: MarketEventsRouteDeps = {}): Router {
  const router = Router();
  const db = deps.prisma ?? defaultPrisma;

  router.use(guardEnabled);

  router.get("/api/market-events", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await listMarketEvents(
        {
          from: String(req.query.from ?? "").trim() || undefined,
          to: String(req.query.to ?? "").trim() || undefined,
          symbol: String(req.query.symbol ?? "").trim() || undefined,
          eventType: (String(req.query.eventType ?? "").trim() || undefined) as MarketEventType | undefined,
          importance: (String(req.query.importance ?? "").trim() || undefined) as EventImportance | undefined,
          limit: Number.parseInt(String(req.query.limit ?? "50"), 10) || 50,
        },
        db,
      );
      res.json({ events });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/market-events/watchlist",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const result = await listWatchlistMarketEvents(
          userId,
          {
            from: String(req.query.from ?? "").trim() || undefined,
            to: String(req.query.to ?? "").trim() || undefined,
            eventType: (String(req.query.eventType ?? "").trim() || undefined) as MarketEventType | undefined,
            importance: (String(req.query.importance ?? "").trim() || undefined) as EventImportance | undefined,
            limit: Number.parseInt(String(req.query.limit ?? "40"), 10) || 40,
          },
          db,
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/market-events/watchlist/digest",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const digest = await buildWatchlistDailyDigest(userId, db);
        res.json(digest);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/event-subscriptions",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const rows = await db.eventSubscription.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        res.json({ items: rows });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/event-subscriptions",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const body = req.body as Record<string, unknown>;
        const payload = {
          ...defaultEventSubscription(userId),
          symbol: body.symbol ? String(body.symbol).trim().toUpperCase() : null,
          watchlistOnly: body.watchlistOnly !== false,
          eventTypes: Array.isArray(body.eventTypes)
            ? body.eventTypes.map((t) => String(t))
            : defaultEventSubscription(userId).eventTypes,
          channels: Array.isArray(body.channels)
            ? body.channels.map((c) => String(c))
            : ["in_app"],
          minImportance: String(body.minImportance ?? "medium"),
          daysBefore: Array.isArray(body.daysBefore)
            ? body.daysBefore.map((d) => Number(d)).filter((n) => Number.isFinite(n))
            : [7, 3, 1, 0],
          webhookUrl: body.webhookUrl ? String(body.webhookUrl) : null,
          isActive: body.isActive !== false,
        };

        const created = await db.eventSubscription.create({ data: payload });
        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/api/event-subscriptions/:id",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const id = String(req.params.id ?? "").trim();
        const existing = await db.eventSubscription.findFirst({ where: { id, userId } });
        if (!existing) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        const body = req.body as Record<string, unknown>;
        const updated = await db.eventSubscription.update({
          where: { id },
          data: {
            ...(body.symbol !== undefined
              ? { symbol: body.symbol ? String(body.symbol).trim().toUpperCase() : null }
              : {}),
            ...(body.watchlistOnly !== undefined ? { watchlistOnly: Boolean(body.watchlistOnly) } : {}),
            ...(Array.isArray(body.eventTypes) ? { eventTypes: body.eventTypes.map((t) => String(t)) } : {}),
            ...(Array.isArray(body.channels) ? { channels: body.channels.map((c) => String(c)) } : {}),
            ...(body.minImportance !== undefined ? { minImportance: String(body.minImportance) } : {}),
            ...(Array.isArray(body.daysBefore)
              ? { daysBefore: body.daysBefore.map((d) => Number(d)).filter((n) => Number.isFinite(n)) }
              : {}),
            ...(body.webhookUrl !== undefined
              ? { webhookUrl: body.webhookUrl ? String(body.webhookUrl) : null }
              : {}),
            ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          },
        });
        res.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/event-subscriptions/default",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const row = await upsertDefaultSubscription(userId, db);
        res.json(row);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
