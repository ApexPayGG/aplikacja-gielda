import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { cacheJsonGet } from "../cache/jsonCache";
import { redisKeys } from "../config/redis";
import { getRequestPath, resolveUserTier, type UserTier } from "./aiBriefRateLimit";
import { tryGetAuthenticatedUserId } from "../modules/auth/authMiddleware";
import { getCacheRedis } from "../redis";

/** Max Claude calls per day for Premium story/catch (not verdict/personal-fit/twins). */
export const PREMIUM_LLM_PRO_DAILY_LIMIT = Number(process.env.PREMIUM_LLM_PRO_DAILY_LIMIT ?? 12);
export const PREMIUM_LLM_PRO_PLUS_DAILY_LIMIT = Number(process.env.PREMIUM_LLM_PRO_PLUS_DAILY_LIMIT ?? 40);
const PREMIUM_LLM_WINDOW_SEC = 86_400;

const PREMIUM_LLM_PATH = /^\/api\/premium\/[^/]+\/(story|catch)\/?$/i;

type CounterStore = {
  increment: (key: string, windowSec: number) => Promise<{ count: number; resetIn: number }>;
};

function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "unknown";
}

function dailyLimitForTier(tier: UserTier): number | null {
  if (tier === "PRO_PLUS") {
    return PREMIUM_LLM_PRO_PLUS_DAILY_LIMIT > 0 ? PREMIUM_LLM_PRO_PLUS_DAILY_LIMIT : null;
  }
  if (tier === "PRO") {
    return PREMIUM_LLM_PRO_DAILY_LIMIT > 0 ? PREMIUM_LLM_PRO_DAILY_LIMIT : null;
  }
  return 0;
}

function buildPremiumLlmKey(tier: UserTier, subjectId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `premium_llm:${tier.toLowerCase()}:${sanitizeId(subjectId)}:${day}`;
}

export function isPremiumLlmRateLimitedPath(path: string): boolean {
  const normalized = (path.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  return PREMIUM_LLM_PATH.test(normalized);
}

function extractPremiumTicker(path: string): string | null {
  const match = path.match(/^\/api\/premium\/([^/]+)\/(story|catch)/i);
  return match?.[1]?.trim().toUpperCase() ?? null;
}

/** Story act1 or catch payload already in Redis — no new Claude call needed. */
export async function peekPremiumLlmCached(req: Request): Promise<boolean> {
  const path = getRequestPath(req);
  if (!isPremiumLlmRateLimitedPath(path)) return false;

  const ticker = extractPremiumTicker(path);
  if (!ticker) return false;

  if (/\/catch\/?$/i.test(path)) {
    const cached = await cacheJsonGet(redisKeys.premiumCatch(ticker));
    return cached != null;
  }

  const language = String(req.query.language ?? "en");
  const experienceLevel = String(req.query.experienceLevel ?? "intermediate");
  const act1Key = redisKeys.premiumStoryAct(ticker, 1, language, experienceLevel);
  const cached = await cacheJsonGet(act1Key);
  return cached != null;
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
      return {
        count: existing.count,
        resetIn: Math.max(1, Math.ceil((existing.expiresAt - nowMs) / 1000)),
      };
    },
  };
}

function createCounterStore(): CounterStore {
  try {
    const redis = getCacheRedis();
    return {
      async increment(key: string, windowSec: number) {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        const ttl = await redis.ttl(key);
        return { count, resetIn: ttl > 0 ? ttl : windowSec };
      },
    };
  } catch {
    return createMemoryStore();
  }
}

const defaultStore = createCounterStore();

export type PremiumLlmRateResult =
  | { allowed: true }
  | { allowed: false; limit: number; resetIn: number; tier: UserTier };

export async function enforcePremiumLlmDailyLimit(
  req: Request,
  prisma?: PrismaClient,
  store: CounterStore = defaultStore,
): Promise<PremiumLlmRateResult> {
  if (!isPremiumLlmRateLimitedPath(getRequestPath(req))) {
    return { allowed: true };
  }

  const tier = await resolveUserTier(req, prisma);
  const limit = dailyLimitForTier(tier);
  if (limit === null) return { allowed: true };
  if (limit <= 0) {
    return { allowed: false, limit: 0, resetIn: PREMIUM_LLM_WINDOW_SEC, tier };
  }

  const userId = tryGetAuthenticatedUserId(req);
  const subject = userId ?? getClientIp(req);
  const key = buildPremiumLlmKey(tier, subject);
  const { count, resetIn } = await store.increment(key, PREMIUM_LLM_WINDOW_SEC);

  if (count > limit) {
    return { allowed: false, limit, resetIn, tier };
  }
  return { allowed: true };
}

type MiddlewareDeps = { prisma?: PrismaClient };

export function createPremiumLlmRateLimitMiddleware(
  deps: MiddlewareDeps = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isPremiumLlmRateLimitedPath(getRequestPath(req))) {
      next();
      return;
    }

    try {
      if (await peekPremiumLlmCached(req)) {
        next();
        return;
      }

      const rate = await enforcePremiumLlmDailyLimit(req, deps.prisma);
      if (!rate.allowed) {
        res.status(429).json({
          error: "PREMIUM_LLM_DAILY_LIMIT",
          message: "Daily limit of AI-generated premium analyses reached. Cached results remain available.",
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
