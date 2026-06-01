import type { PremiumAnalysisBundle } from "../services/api";

const sessionCache = new Map<string, PremiumAnalysisBundle>();

export function premiumAnalysisV2CacheKey(ticker: string, language: string): string {
  return `${ticker.trim().toUpperCase()}:${language.trim().toLowerCase() || "en"}`;
}

export function getPremiumAnalysisV2SessionCache(key: string): PremiumAnalysisBundle | undefined {
  return sessionCache.get(key);
}

export function setPremiumAnalysisV2SessionCache(key: string, bundle: PremiumAnalysisBundle): void {
  sessionCache.set(key, bundle);
}
