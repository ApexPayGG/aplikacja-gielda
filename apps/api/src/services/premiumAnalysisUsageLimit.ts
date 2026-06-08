import type { UserTier } from "./aiBriefRateLimit";
import { getCacheRedis } from "../redis";

/** Parse env daily limit; invalid values fall back to defaultValue. */
export function parsePremiumAnalysisDailyLimit(raw: unknown, defaultValue: number): number {
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw === "string" && raw.trim() === "") return defaultValue;
  const parsed = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.trunc(parsed);
}

/** Max fresh Premium Analysis V2 generations per day (cache miss / Anthropic path). */
export const PREMIUM_ANALYSIS_PRO_DAILY_LIMIT = parsePremiumAnalysisDailyLimit(
  process.env.PREMIUM_ANALYSIS_PRO_DAILY_LIMIT,
  3,
);
export const PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT = parsePremiumAnalysisDailyLimit(
  process.env.PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT,
  10,
);
export const PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT = parsePremiumAnalysisDailyLimit(
  process.env.PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT,
  PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT,
);
export const PREMIUM_ANALYSIS_WINDOW_SEC = 86_400;

type CounterStore = {
  increment: (key: string, windowSec: number) => Promise<{ count: number; resetIn: number }>;
};

export type PremiumAnalysisUsageLimitResult =
  | { allowed: true; limit: number; remaining: number; resetIn: number; tier: UserTier }
  | { allowed: false; limit: number; resetIn: number; tier: UserTier };

export type EnforcePremiumAnalysisDailyLimitInput = {
  tier: UserTier | string;
  userId?: string | null;
  clientIp?: string | null;
  accessState?: string | null;
  canUseProduct?: boolean | null;
  store?: CounterStore;
};

export function isActiveTrialAccess(accessState: unknown): boolean {
  return accessState === "TRIAL_ACTIVE" || accessState === "SUBSCRIPTION_TRIALING";
}

function normalizeTier(value: unknown): UserTier {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "PRO_PLUS") return "PRO_PLUS";
  if (normalized === "PRO") return "PRO";
  return "FREE";
}

function sanitizeSubjectId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "unknown";
}

function dailyLimitForInput(input: EnforcePremiumAnalysisDailyLimitInput): number {
  if (input.canUseProduct === false) return 0;

  const tier = normalizeTier(input.tier);
  if (tier === "PRO_PLUS") return PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT;
  if (tier === "PRO") return PREMIUM_ANALYSIS_PRO_DAILY_LIMIT;
  if (tier === "FREE" && isActiveTrialAccess(input.accessState)) {
    return PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT;
  }
  return 0;
}

function resolveSubjectId(input: EnforcePremiumAnalysisDailyLimitInput): string {
  const userId = input.userId?.trim();
  if (userId) return userId;
  const clientIp = input.clientIp?.trim();
  if (clientIp) return clientIp;
  return "anonymous";
}

export function buildPremiumAnalysisUsageKey(tierInput: UserTier | string, subjectId: string): string {
  const tier = normalizeTier(tierInput);
  const day = new Date().toISOString().slice(0, 10);
  return `premium_analysis:${tier.toLowerCase()}:${sanitizeSubjectId(subjectId)}:${day}`;
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

let defaultStore: CounterStore | null = null;

function getDefaultStore(): CounterStore {
  if (!defaultStore) defaultStore = createCounterStore();
  return defaultStore;
}

export async function enforcePremiumAnalysisDailyLimit(
  input: EnforcePremiumAnalysisDailyLimitInput,
): Promise<PremiumAnalysisUsageLimitResult> {
  const tier = normalizeTier(input.tier);
  const limit = dailyLimitForInput(input);
  if (limit <= 0) {
    return { allowed: false, limit, resetIn: PREMIUM_ANALYSIS_WINDOW_SEC, tier };
  }

  const store = input.store ?? getDefaultStore();
  const subject = resolveSubjectId(input);
  const key = buildPremiumAnalysisUsageKey(tier, subject);
  const { count, resetIn } = await store.increment(key, PREMIUM_ANALYSIS_WINDOW_SEC);

  if (count > limit) {
    return { allowed: false, limit, resetIn, tier };
  }
  return { allowed: true, limit, remaining: Math.max(0, limit - count), resetIn, tier };
}
