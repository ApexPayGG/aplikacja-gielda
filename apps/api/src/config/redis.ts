import { createHash } from "node:crypto";
import process from "node:process";

/** TTL (seconds) — StockAI Pro / Dividend Screening cache strategy. */
export const REDIS_TTL_SEC = {
  /** Latest quote per symbol */
  QUOTES: 300,
  /** Recent news list per symbol */
  NEWS: 1800,
  /** Dividend history (API) */
  DIVIDEND: 86_400,
  /** Company search results */
  SEARCH: 300,
  /** Dividend growth screener (aggregated) */
  SCREENER: 3600,
  /** Claude analysis brief (expensive); aligns with screener refresh cadence */
  AI_ANALYSIS: 3600,
  /** Dividend intelligence snapshot per symbol */
  INTELLIGENCE_DIVIDEND: 86_400,
  /** Recent dividend alerts per symbol */
  ALERTS_DIVIDEND: 3600,
  /** Sector avg safety score (Dividend Intelligence dashboard) */
  SECTOR_DIVIDEND_COMPARISON: 86_400,
  /** GET /api/ai/dividend/sustainability/:symbol — snapshot z DB */
  SUSTAINABILITY_DIVIDEND: 86_400,
  /** Premium analysis screen 1 verdict */
  PREMIUM_VERDICT: 3_600,
  /** Premium analysis screen 2 personal fit per user */
  PREMIUM_PERSONAL_FIT: 3_600,
  /** Premium analysis story act 1 */
  PREMIUM_STORY_ACT1: 30 * 86_400,
  /** Premium analysis story act 2 */
  PREMIUM_STORY_ACT2: 86_400,
  /** Premium analysis story act 3 */
  PREMIUM_STORY_ACT3: 7 * 86_400,
  /** Premium analysis twins */
  PREMIUM_TWINS: 7 * 86_400,
  /** Premium analysis catch */
  PREMIUM_CATCH: 86_400,
  /** XML sitemap payload */
  SITEMAP: 3_600,
} as const;

const KEY_PREFIX = "cache:v1";

function shortHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 24);
}

export const redisKeys = {
  quoteLatest: (symbol: string) => `${KEY_PREFIX}:quote:latest:${symbol.trim().toUpperCase()}`,
  newsRecent: (symbol: string, limit: number) =>
    `${KEY_PREFIX}:news:${symbol.trim().toUpperCase()}:l${limit}`,
  companySearch: (query: string, limit: number) =>
    `${KEY_PREFIX}:search:companies:${shortHash(`${query.trim().toLowerCase()}\0${limit}`)}`,
  dividendHistory: (symbol: string, years: number) =>
    `${KEY_PREFIX}:dividend:history:${symbol.trim().toUpperCase()}:${years}`,
  // Pełny klucz: cache:v1:screener:dividend:growth:v2:<sha256[:24] JSON filtrów>. Flush: npm run redis:flushdb (REDIS_FLUSH_CONFIRM=YES).
  screenerDividendGrowth: (filters: {
    minYears: number;
    minYield: number;
    limit: number;
    offset: number;
  }) => `${KEY_PREFIX}:screener:dividend:growth:v2:${shortHash(JSON.stringify(filters))}`,
  analysisBrief: (symbol: string, langKey: string) =>
    `${KEY_PREFIX}:analysis:${symbol.trim().toUpperCase()}:${langKey}`,
  intelligenceDividend: (symbol: string) =>
    `${KEY_PREFIX}:intelligence:dividend:${symbol.trim().toUpperCase()}`,
  alertsDividend: (symbol: string) => `${KEY_PREFIX}:alerts:dividend:${symbol.trim().toUpperCase()}`,
  sectorDividendComparison: () => `${KEY_PREFIX}:sector:dividend:comparison`,
  sustainabilityDividend: (symbol: string) =>
    `${KEY_PREFIX}:sustainability:dividend:${symbol.trim().toUpperCase()}`,
  premiumVerdict: (symbol: string) => `${KEY_PREFIX}:premium:verdict:${symbol.trim().toUpperCase()}`,
  premiumPersonalFit: (symbol: string, userId: string) =>
    `${KEY_PREFIX}:premium:personal-fit:${symbol.trim().toUpperCase()}:${shortHash(userId)}`,
  premiumStoryAct: (symbol: string, act: 1 | 2 | 3, lang: string, level: string) =>
    `${KEY_PREFIX}:premium:story:${symbol.trim().toUpperCase()}:act${act}:${shortHash(`${lang}\0${level}`)}`,
  premiumTwins: (symbol: string, limit: number, minMatch: number) =>
    `${KEY_PREFIX}:premium:twins:${symbol.trim().toUpperCase()}:l${limit}:m${minMatch}`,
  premiumCatch: (symbol: string) => `${KEY_PREFIX}:premium:catch:${symbol.trim().toUpperCase()}`,
  sitemapXml: () => `${KEY_PREFIX}:sitemap:xml`,
} as const;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}
