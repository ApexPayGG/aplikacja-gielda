import { randomUUID } from "node:crypto";
import type { AnalysisResult } from "../ai/analysis";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { isRedisConfigured, REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { getCacheRedis } from "../redis";

/**
 * GLOBAL CACHE SCOPE — company AI brief only (`cache:v1:analysis:{SYMBOL}:{lang}`).
 * Never use for: Behavioral Coach, Personal Fit, portfolio, watchlist insights, decision journal.
 * Premium personal-fit uses `premiumPersonalFit` with userId in the key.
 */

const LOCK_POLL_MS = 250;

function lockTtlSec(): number {
  const raw = Number(process.env.AI_BRIEF_LOCK_TTL_SEC ?? 45);
  return Number.isFinite(raw) && raw >= 15 ? raw : 45;
}

function lockWaitMs(): number {
  const raw = Number(process.env.AI_BRIEF_LOCK_WAIT_MS ?? 45_000);
  return Number.isFinite(raw) && raw >= 200 ? raw : 45_000;
}

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

export class BriefGenerationBusyError extends Error {
  readonly symbol: string;
  readonly lang: string;

  constructor(symbol: string, lang: string) {
    super(`Brief generation in progress for ${symbol} (${lang})`);
    this.name = "BriefGenerationBusyError";
    this.symbol = symbol;
    this.lang = lang;
  }
}

function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

export function cacheKeySuffixForLang(lang: string): string {
  if (primaryLanguageBase(lang) === "en") return "en";
  return lang.toLowerCase().replace(/[^a-z0-9_-]+/g, "") || "und";
}

function briefCacheTtlSec(): number {
  const raw = Number(process.env.AI_BRIEF_CACHE_TTL_SEC ?? REDIS_TTL_SEC.AI_ANALYSIS);
  if (!Number.isFinite(raw) || raw < 300) return REDIS_TTL_SEC.AI_ANALYSIS;
  return Math.min(Math.floor(raw), 86_400);
}

function normalizeCachedPayload(parsed: AnalysisResult): AnalysisResult | null {
  if (parsed.updatedAt && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
    return {
      ...parsed,
      brief: parsed.brief || parsed.sections.map((s) => s.body).join("\n\n---\n\n"),
    };
  }
  const legacy = parsed as unknown as { brief?: string; updatedAt?: string; sections?: unknown };
  if (legacy.brief && legacy.updatedAt && !legacy.sections) {
    return null;
  }
  return null;
}

function briefDataKey(symbol: string, lang: string): string {
  return redisKeys.analysisBrief(symbol.trim().toUpperCase(), cacheKeySuffixForLang(lang));
}

function briefLockKey(symbol: string, lang: string): string {
  return redisKeys.analysisBriefLock(symbol.trim().toUpperCase(), cacheKeySuffixForLang(lang));
}

/** Exact locale cache only — never serves EN body to a PL UI request. */
export async function peekCachedBriefExact(symbol: string, localeTag = "en"): Promise<AnalysisResult | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  const lang = (localeTag.trim() || "en").trim();
  const primary = await cacheJsonGet<AnalysisResult>(briefDataKey(sym, lang));
  if (!primary) return null;
  return normalizeCachedPayload(primary);
}

/** English source for cheap translation path (not returned directly to non-EN clients). */
export async function peekCachedBriefEnglish(symbol: string): Promise<AnalysisResult | null> {
  return peekCachedBriefExact(symbol, "en");
}

/** @deprecated Use peekCachedBriefExact for serving; kept for internal callers. */
export async function peekCachedBrief(symbol: string, localeTag = "en"): Promise<AnalysisResult | null> {
  return peekCachedBriefExact(symbol, localeTag);
}

export async function storeCachedBrief(
  symbol: string,
  localeTag: string,
  payload: AnalysisResult,
): Promise<void> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return;
  const lang = (localeTag.trim() || "en").trim();
  await cacheJsonSet(briefDataKey(sym, lang), payload, briefCacheTtlSec());
}

async function acquireMemoryLock(lockKey: string, token: string, ttlSec: number): Promise<boolean> {
  const now = Date.now();
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now && existing.token !== token) {
    return false;
  }
  memoryLocks.set(lockKey, { token, expiresAt: now + ttlSec * 1000 });
  return true;
}

async function releaseMemoryLock(lockKey: string, token: string): Promise<void> {
  const existing = memoryLocks.get(lockKey);
  if (existing?.token === token) memoryLocks.delete(lockKey);
}

async function acquireLock(lockKey: string, token: string, ttlSec: number): Promise<boolean> {
  if (!isRedisConfigured()) {
    return acquireMemoryLock(lockKey, token, ttlSec);
  }
  try {
    const redis = getCacheRedis();
    const ok = await redis.set(lockKey, token, "EX", ttlSec, "NX");
    return ok === "OK";
  } catch {
    return acquireMemoryLock(lockKey, token, ttlSec);
  }
}

async function releaseLock(lockKey: string, token: string): Promise<void> {
  if (!isRedisConfigured()) {
    await releaseMemoryLock(lockKey, token);
    return;
  }
  try {
    const redis = getCacheRedis();
    const current = await redis.get(lockKey);
    if (current === token) await redis.del(lockKey);
  } catch {
    await releaseMemoryLock(lockKey, token);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExactCache(symbol: string, localeTag: string, maxMs: number): Promise<AnalysisResult | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const hit = await peekCachedBriefExact(symbol, localeTag);
    if (hit) return hit;
    await sleep(LOCK_POLL_MS);
  }
  return null;
}

/**
 * Single-flight guard: one Claude/translation run per symbol+lang; waiters poll cache.
 */
export async function withBriefGenerationLock<T>(
  symbol: string,
  localeTag: string,
  work: () => Promise<T>,
): Promise<T> {
  const sym = symbol.trim().toUpperCase();
  const lang = (localeTag.trim() || "en").trim();
  const lockKey = briefLockKey(sym, lang);
  const token = randomUUID();
  const ttlSec = lockTtlSec();

  const acquired = await acquireLock(lockKey, token, ttlSec);
  if (!acquired) {
    const waited = await waitForExactCache(sym, lang, lockWaitMs());
    if (waited) return waited as T;
    throw new BriefGenerationBusyError(sym, lang);
  }

  try {
    const cached = await peekCachedBriefExact(sym, lang);
    if (cached) return cached as T;
    return await work();
  } finally {
    await releaseLock(lockKey, token);
  }
}

export function extractBriefSymbolFromPath(path: string): string | null {
  const normalized = (path.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  const patterns = [
    /^\/api\/analysis\/([^/]+)$/i,
    /^\/api\/brief\/([^/]+)$/i,
    /^\/api\/companies\/([^/]+)\/brief$/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const sym = match?.[1]?.trim().toUpperCase();
    if (sym) return sym;
  }
  return null;
}
