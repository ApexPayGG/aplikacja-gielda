import type { AnalysisResult } from "../ai/analysis";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { SingleFlightTimeoutError, withSingleFlight } from "../utils/singleFlight";

/**
 * GLOBAL CACHE SCOPE — company AI brief only (`cache:v1:analysis:{SYMBOL}:{lang}`).
 * Never use for: Behavioral Coach, Personal Fit, portfolio, watchlist insights, decision journal.
 * Premium personal-fit uses `premiumPersonalFit` with userId in the key.
 */

function lockTtlSec(): number {
  const raw = Number(process.env.AI_BRIEF_LOCK_TTL_SEC ?? 45);
  return Number.isFinite(raw) && raw >= 15 ? raw : 45;
}

function lockWaitMs(): number {
  const raw = Number(process.env.AI_BRIEF_LOCK_WAIT_MS ?? 45_000);
  return Number.isFinite(raw) && raw >= 200 ? raw : 45_000;
}

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

  try {
    const result = await withSingleFlight<AnalysisResult>(
      lockKey,
      {
        scope: "ai_brief",
        lockTtlSeconds: lockTtlSec(),
        maxWaitMs: lockWaitMs(),
        waitMs: 250,
        readAfterWait: async (): Promise<AnalysisResult | null> => {
          const hit = await peekCachedBriefExact(sym, lang);
          return hit ?? null;
        },
      },
      async (): Promise<AnalysisResult> => {
        const cached = await peekCachedBriefExact(sym, lang);
        if (cached) return cached;
        return (await work()) as AnalysisResult;
      },
    );
    return result as T;
  } catch (error) {
    if (error instanceof SingleFlightTimeoutError) {
      const waited = await peekCachedBriefExact(sym, lang);
      if (waited) return waited as T;
      throw new BriefGenerationBusyError(sym, lang);
    }
    throw error;
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
