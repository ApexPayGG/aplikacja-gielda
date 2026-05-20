import type { AnalysisResult } from "../ai/analysis";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";

function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

function cacheKeySuffixForLang(lang: string): string {
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

/**
 * Shared Redis brief for all users: cache:v1:analysis:{SYMBOL}:{langKey}
 * Non-English locales fall back to English cache when available (saves Anthropic calls).
 */
export async function peekCachedBrief(symbol: string, localeTag = "en"): Promise<AnalysisResult | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;

  const lang = (localeTag.trim() || "en").trim();
  const primaryKey = redisKeys.analysisBrief(sym, cacheKeySuffixForLang(lang));
  const primary = await cacheJsonGet<AnalysisResult>(primaryKey);
  if (primary) {
    const normalized = normalizeCachedPayload(primary);
    if (normalized) return normalized;
  }

  if (primaryLanguageBase(lang) === "en") return null;

  const enKey = redisKeys.analysisBrief(sym, "en");
  const enCached = await cacheJsonGet<AnalysisResult>(enKey);
  if (!enCached) return null;
  return normalizeCachedPayload(enCached);
}

export async function storeCachedBrief(
  symbol: string,
  localeTag: string,
  payload: AnalysisResult,
): Promise<void> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return;
  const lang = (localeTag.trim() || "en").trim();
  const key = redisKeys.analysisBrief(sym, cacheKeySuffixForLang(lang));
  await cacheJsonSet(key, payload, briefCacheTtlSec());
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
