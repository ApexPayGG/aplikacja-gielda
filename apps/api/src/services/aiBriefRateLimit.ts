import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { tryGetAuthenticatedUserId, type AuthenticatedRequest } from "../modules/auth/authMiddleware";
import { getCacheRedis } from "../redis";
import { extractBriefSymbolFromPath, peekCachedBrief } from "./aiBriefCache";

export type UserTier = "FREE" | "PRO" | "PRO_PLUS";

export const AI_BRIEF_FREE_LIMIT = 3;
export const AI_BRIEF_PRO_DAILY_LIMIT = Number(process.env.AI_BRIEF_PRO_DAILY_LIMIT ?? 20);
export const AI_BRIEF_PRO_PLUS_DAILY_LIMIT = Number(process.env.AI_BRIEF_PRO_PLUS_DAILY_LIMIT ?? 60);
export const AI_BRIEF_FREE_WINDOW_SEC = 86_400;

export type AiBriefRateLimitResult =
  | { allowed: true }
  | { allowed: false; limit: number; resetIn: number; tier: UserTier };

type CounterStore = {
  increment: (key: string, windowSec: number) => Promise<{ count: number; resetIn: number }>;
};

function normalizeTier(value: unknown): UserTier {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "PRO_PLUS") return "PRO_PLUS";
  if (normalized === "PRO") return "PRO";
  return "FREE";
}

function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function sanitizeSubjectId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "unknown";
}

export function buildAiBriefRateLimitKey(tier: UserTier, subjectId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `ai_brief:${tier.toLowerCase()}:${sanitizeSubjectId(subjectId)}:${day}`;
}

/** Full request path (not mount-stripped `req.path`). */
export function getRequestPath(req: Request): string {
  const fromOriginal = req.originalUrl?.split("?")[0];
  if (fromOriginal) return fromOriginal;
  return req.path || "";
}

const AI_BRIEF_PATH_PATTERNS = [
  /^\/api\/analysis\/[^/]+\/?$/,
  /^\/api\/brief\/[^/]+\/?$/,
  /^\/api\/companies\/[^/]+\/brief\/?$/,
] as const;

/** Daily AI Brief generation limits — only on cache miss (see middleware). */
export function isAiBriefRateLimitedPath(path: string): boolean {
  const normalized = (path.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return AI_BRIEF_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function dailyLimitForTier(tier: UserTier): number | null {
  if (tier === "PRO_PLUS") {
    return AI_BRIEF_PRO_PLUS_DAILY_LIMIT > 0 ? AI_BRIEF_PRO_PLUS_DAILY_LIMIT : null;
  }
  if (tier === "PRO") {
    return AI_BRIEF_PRO_DAILY_LIMIT > 0 ? AI_BRIEF_PRO_DAILY_LIMIT : null;
  }
  return AI_BRIEF_FREE_LIMIT;
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
        return { count: 1, resetIn: windowSec };
      }

      existing.count += 1;
      const resetIn = Math.max(1, Math.ceil((existing.expiresAt - nowMs) / 1000));
      return { count: existing.count, resetIn };
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
        return { count, resetIn: ttl > 0 ? ttl : windowSec };
      },
    };
  } catch {
    return createMemoryStore();
  }
}

const defaultStore = createCounterStore();

export async function resolveUserTier(req: Request, prisma?: PrismaClient): Promise<UserTier> {
  const userId = tryGetAuthenticatedUserId(req);
  if (!userId || !prisma) return "FREE";

  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { tier: true } })
    .catch(() => null);
  return normalizeTier(user?.tier);
}

export function resolveAiBriefRateSubject(req: Request): string {
  const userId = tryGetAuthenticatedUserId(req);
  if (userId) return userId;
  return getClientIp(req);
}

function briefLocaleFromRequest(req: Request): string {
  const q = req.query.lang ?? req.query.language ?? req.query.locale;
  const raw = Array.isArray(q) ? q[0] : q;
  return String(raw ?? "en").trim() || "en";
}

/** True when Redis already has a brief for this symbol (shared across users). */
export async function peekAiBriefCached(req: Request): Promise<boolean> {
  const symbol = extractBriefSymbolFromPath(getRequestPath(req));
  if (!symbol) return false;
  const cached = await peekCachedBrief(symbol, briefLocaleFromRequest(req));
  return cached != null;
}

export async function enforceAiBriefRateLimit(
  req: Request,
  prisma?: PrismaClient,
  store: CounterStore = defaultStore,
): Promise<AiBriefRateLimitResult> {
  if (!isAiBriefRateLimitedPath(getRequestPath(req))) {
    return { allowed: true };
  }

  const tier = await resolveUserTier(req, prisma);
  const limit = dailyLimitForTier(tier);
  if (limit === null) return { allowed: true };

  const subject = resolveAiBriefRateSubject(req);
  const key = buildAiBriefRateLimitKey(tier, subject);
  const { count, resetIn } = await store.increment(key, AI_BRIEF_FREE_WINDOW_SEC);

  if (count > limit) {
    return { allowed: false, limit, resetIn, tier };
  }

  return { allowed: true };
}

/** @deprecated Use enforceAiBriefRateLimit */
export async function enforceAiBriefFreeRateLimit(
  req: Request,
  prisma?: PrismaClient,
  store?: CounterStore,
): Promise<AiBriefRateLimitResult> {
  return enforceAiBriefRateLimit(req, prisma, store);
}

type AiBriefRateLimitMiddlewareDeps = {
  prisma?: PrismaClient;
};

export function createAiBriefRateLimitMiddleware(
  deps: AiBriefRateLimitMiddlewareDeps = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isAiBriefRateLimitedPath(getRequestPath(req))) {
      next();
      return;
    }

    try {
      if (await peekAiBriefCached(req)) {
        next();
        return;
      }

      const rate = await enforceAiBriefRateLimit(req, deps.prisma);
      if (!rate.allowed) {
        res.status(429).json({
          error: "LIMIT_REACHED",
          message: "Daily limit of new AI brief generations reached. Try again tomorrow or open a recently cached symbol.",
          tier: rate.tier,
          limit: rate.limit,
          resetIn: rate.resetIn,
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** @internal test helper */
export function hasAuthenticatedUser(req: Request): boolean {
  return Boolean((req as AuthenticatedRequest).auth?.userId);
}
