import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getCacheRedis } from "../redis";

type UserTier = "FREE" | "PRO" | "PRO_PLUS";

type RateLimiterDeps = {
  prisma?: PrismaClient;
  getUserTier?: (userId: string) => Promise<UserTier>;
  now?: () => Date;
  store?: CounterStore;
};

type CounterStore = {
  increment: (key: string, windowSec: number) => Promise<{ count: number; retryAfterSec: number }>;
};

type TierCacheRecord = {
  tier: UserTier;
  expiresAt: number;
};

const AUTH_LOGIN_LIMIT = { limit: 5, windowSec: 15 * 60 };
const AUTH_REGISTER_LIMIT = { limit: 3, windowSec: 60 * 60 };
const AUTH_FORGOT_PASSWORD_LIMIT = { limit: 3, windowSec: 60 * 60 };
const CONTACT_LIMIT = { limit: 3, windowSec: 60 * 60 };
const STRIPE_LIMIT = { limit: 10, windowSec: 60 };
/** Monthly Premium Analysis calls for unauthenticated / FREE users only. */
const PREMIUM_FREE_MONTHLY_LIMIT = 10;

function normalizeTier(value: unknown): UserTier {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "PRO_PLUS") return "PRO_PLUS";
  if (normalized === "PRO") return "PRO";
  return "FREE";
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractUserId(req: Request): string | null {
  const authUserId = getString((req as Request & { auth?: { userId?: string } }).auth?.userId);
  if (authUserId) return authUserId;

  const paramsUserId = getString(req.params.userId);
  if (paramsUserId) return paramsUserId;

  const queryUserId = getString((req.query as Record<string, unknown>).userId);
  if (queryUserId) return queryUserId;

  const body = (req as Request & { body?: Record<string, unknown> }).body;
  const bodyUserId = getString(body?.userId);
  if (bodyUserId) return bodyUserId;

  return null;
}

function getMonthKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getSecondsUntilNextMonth(now: Date): number {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  const diffMs = nextMonth.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / 1000));
}

function createMemoryStore(): CounterStore {
  const store = new Map<string, { count: number; expiresAt: number }>();

  return {
    async increment(key: string, windowSec: number) {
      const nowMs = Date.now();
      const existing = store.get(key);
      if (!existing || existing.expiresAt <= nowMs) {
        const expiresAt = nowMs + windowSec * 1000;
        store.set(key, { count: 1, expiresAt });
        return { count: 1, retryAfterSec: windowSec };
      }

      existing.count += 1;
      const retryAfterSec = Math.max(1, Math.ceil((existing.expiresAt - nowMs) / 1000));
      return { count: existing.count, retryAfterSec };
    },
  };
}

function createCounterStore(): CounterStore {
  try {
    const redis = getCacheRedis();
    return {
      async increment(key: string, windowSec: number) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSec);
        }
        const ttl = await redis.ttl(key);
        return { count, retryAfterSec: ttl > 0 ? ttl : windowSec };
      },
    };
  } catch {
    return createMemoryStore();
  }
}

async function enforceLimit(
  res: Response,
  store: CounterStore,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const { count, retryAfterSec } = await store.increment(key, windowSec);
  const remaining = Math.max(0, limit - count);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));

  if (count > limit) {
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return false;
  }

  return true;
}

export function createRateLimiterMiddleware(deps?: RateLimiterDeps): RequestHandler {
  const now = deps?.now ?? (() => new Date());
  const store = deps?.store ?? createCounterStore();
  const tierCache = new Map<string, TierCacheRecord>();

  const defaultGetUserTier = async (userId: string): Promise<UserTier> => {
    if (!deps?.prisma) return "FREE";

    const cached = tierCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tier;
    }

    const user = await deps.prisma.user
      .findUnique({ where: { id: userId }, select: { tier: true } })
      .catch(() => null);
    const tier = normalizeTier(user?.tier);
    tierCache.set(userId, { tier, expiresAt: Date.now() + 60_000 });
    return tier;
  };

  const getUserTier = deps?.getUserTier ?? defaultGetUserTier;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = req.path;
      const method = req.method.toUpperCase();
      const ip = getClientIp(req);
      const requestUserId = extractUserId(req);

      if (method === "POST" && path === "/api/auth/login") {
        const ok = await enforceLimit(
          res,
          store,
          `rate:auth:login:ip:${ip}`,
          AUTH_LOGIN_LIMIT.limit,
          AUTH_LOGIN_LIMIT.windowSec,
        );
        if (!ok) return;
      }

      if (method === "POST" && path === "/api/auth/register") {
        const ok = await enforceLimit(
          res,
          store,
          `rate:auth:register:ip:${ip}`,
          AUTH_REGISTER_LIMIT.limit,
          AUTH_REGISTER_LIMIT.windowSec,
        );
        if (!ok) return;
      }

      if (method === "POST" && path === "/api/auth/forgot-password") {
        const ok = await enforceLimit(
          res,
          store,
          `rate:auth:forgot-password:ip:${ip}`,
          AUTH_FORGOT_PASSWORD_LIMIT.limit,
          AUTH_FORGOT_PASSWORD_LIMIT.windowSec,
        );
        if (!ok) return;
      }

      if (method === "POST" && path === "/api/contact") {
        const ok = await enforceLimit(
          res,
          store,
          `rate:contact:ip:${ip}`,
          CONTACT_LIMIT.limit,
          CONTACT_LIMIT.windowSec,
        );
        if (!ok) return;
      }

      if (path.startsWith("/api/stripe/")) {
        const subject = requestUserId ? `user:${requestUserId}` : `ip:${ip}`;
        const ok = await enforceLimit(
          res,
          store,
          `rate:stripe:${subject}`,
          STRIPE_LIMIT.limit,
          STRIPE_LIMIT.windowSec,
        );
        if (!ok) return;
      }

      // Premium Analysis (/api/premium/*) — separate monthly tier limits; not AI Brief (see aiBriefRateLimit.ts).
      if (path.startsWith("/api/premium/")) {
        const month = getMonthKey(now());
        const windowSec = getSecondsUntilNextMonth(now());
        if (!requestUserId) {
          const ok = await enforceLimit(
            res,
            store,
            `rate:premium:${month}:ip:${ip}`,
            PREMIUM_FREE_MONTHLY_LIMIT,
            windowSec,
          );
          if (!ok) return;
          next();
          return;
        }

        const tier = await getUserTier(requestUserId);
        if (tier === "PRO" || tier === "PRO_PLUS") {
          next();
          return;
        }

        const ok = await enforceLimit(
          res,
          store,
          `rate:premium:${month}:user:${requestUserId}`,
          PREMIUM_FREE_MONTHLY_LIMIT,
          windowSec,
        );
        if (!ok) return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
