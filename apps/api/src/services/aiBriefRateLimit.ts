import type { PrismaClient } from "@prisma/client";
import type { Request } from "express";
import { tryGetAuthenticatedUserId, type AuthenticatedRequest } from "../modules/auth/authMiddleware";
import { getCacheRedis } from "../redis";

export type UserTier = "FREE" | "PRO" | "PRO_PLUS";

export const AI_BRIEF_FREE_LIMIT = 3;
export const AI_BRIEF_FREE_WINDOW_SEC = 86_400;

export type AiBriefRateLimitResult =
  | { allowed: true }
  | { allowed: false; limit: number; resetIn: number };

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
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sanitizeSubjectId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "unknown";
}

export function buildAiBriefRateLimitKey(subjectId: string): string {
  return `ai_brief:free:${sanitizeSubjectId(subjectId)}`;
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

export async function enforceAiBriefFreeRateLimit(
  req: Request,
  prisma?: PrismaClient,
  store: CounterStore = defaultStore,
): Promise<AiBriefRateLimitResult> {
  const tier = await resolveUserTier(req, prisma);
  if (tier === "PRO" || tier === "PRO_PLUS") {
    return { allowed: true };
  }

  const subject = resolveAiBriefRateSubject(req);
  const key = buildAiBriefRateLimitKey(subject);
  const { count, resetIn } = await store.increment(key, AI_BRIEF_FREE_WINDOW_SEC);

  if (count > AI_BRIEF_FREE_LIMIT) {
    return { allowed: false, limit: AI_BRIEF_FREE_LIMIT, resetIn };
  }

  return { allowed: true };
}

/** @internal test helper */
export function hasAuthenticatedUser(req: Request): boolean {
  return Boolean((req as AuthenticatedRequest).auth?.userId);
}
