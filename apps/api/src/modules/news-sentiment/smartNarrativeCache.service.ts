import type IORedis from "ioredis";
import { getCacheRedis } from "../../redis";
import {
  NEWS_SENTIMENT_TTL_SEC,
  type InvalidationState,
  type NarrativeActPayload,
  type NewsSentimentFullPayload,
  type NewsSentimentMetaPayload,
} from "./newsSentiment.types";

export const NEWS_SENTIMENT_LOCK_TTL_SEC = NEWS_SENTIMENT_TTL_SEC.LOCK;

export function normalizeNewsSentimentTicker(ticker: string): string {
  return ticker.trim().toUpperCase().slice(0, 20);
}

export function newsSentimentCacheKeys(ticker: string): {
  act1: string;
  act2: string;
  act3: string;
  meta: string;
  full: string;
  lock: string;
} {
  const sym = normalizeNewsSentimentTicker(ticker);
  const prefix = `stockai:news-sentiment:${sym}`;
  return {
    act1: `${prefix}:act1:v1`,
    act2: `${prefix}:act2:v1`,
    act3: `${prefix}:act3:v1`,
    meta: `${prefix}:meta:v1`,
    full: `${prefix}:full:v1`,
    lock: `stockai:news-sentiment:lock:${sym}`,
  };
}

export function computeMa200(closes: number[]): number | null {
  if (closes.length < 200) return null;
  const window = closes.slice(-200);
  const sum = window.reduce((acc, value) => acc + value, 0);
  return sum / 200;
}

export function computeIntradayChangePct(currentPrice: number, referencePrice: number): number {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    return 0;
  }
  return Math.abs(((currentPrice - referencePrice) / referencePrice) * 100);
}

export function detectMa200Break(
  currentPrice: number,
  ma200: number,
  previousPrice: number | null,
): boolean {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(ma200)) return false;
  if (previousPrice == null || !Number.isFinite(previousPrice)) return false;
  const wasAbove = previousPrice > ma200;
  const isAbove = currentPrice > ma200;
  return wasAbove !== isAbove;
}

export function detectEarningsEventFromHeadlines(headlines: string[]): boolean {
  const pattern = /\b(earnings|eps|quarterly results|q[1-4]\s+\d{4}|guidance)\b/i;
  return headlines.some((headline) => pattern.test(headline));
}

export function shouldInvalidateAct2(signals: {
  intradayChangePct: number;
  earningsEventDetected: boolean;
}): boolean {
  return signals.intradayChangePct > 3 || signals.earningsEventDetected;
}

export function shouldInvalidateAct3(signals: { ma200Break: boolean }): boolean {
  return signals.ma200Break;
}

export type InvalidationTarget = "act2" | "act3";

export function resolveInvalidationTargets(reason: string): InvalidationTarget[] {
  const normalized = reason.trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "manual") {
    return ["act2", "act3"];
  }
  if (
    normalized === "intraday_price_spike" ||
    normalized === "price_spike" ||
    normalized === "earnings_event" ||
    normalized === "earnings"
  ) {
    return ["act2"];
  }
  if (normalized === "ma200_break" || normalized === "ma200") {
    return ["act3"];
  }
  return ["act2", "act3"];
}

function defaultInvalidationState(): InvalidationState {
  return {
    act2Invalidated: false,
    act3Invalidated: false,
    lastInvalidationReason: null,
    lastInvalidatedAt: null,
    intradayChangePct: null,
    ma200Break: false,
    earningsEventDetected: false,
  };
}

type RedisReader = Pick<IORedis, "get">;
type RedisWriter = Pick<IORedis, "get" | "set" | "del">;
type RedisLocker = Pick<IORedis, "set">;

export class SmartNarrativeCacheService {
  constructor(
    private readonly redisFactory: () => RedisReader & RedisWriter & RedisLocker = () => getCacheRedis(),
  ) {}

  private get redis(): RedisReader & RedisWriter & RedisLocker {
    return this.redisFactory();
  }

  async getAct(
    ticker: string,
    act: "act1" | "act2" | "act3",
  ): Promise<NarrativeActPayload | null> {
    const keys = newsSentimentCacheKeys(ticker);
    const raw = await this.redis.get(keys[act]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NarrativeActPayload;
    } catch {
      return null;
    }
  }

  async getMeta(ticker: string): Promise<NewsSentimentMetaPayload | null> {
    const raw = await this.redis.get(newsSentimentCacheKeys(ticker).meta);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NewsSentimentMetaPayload;
    } catch {
      return null;
    }
  }

  async getFull(ticker: string): Promise<NewsSentimentFullPayload | null> {
    const raw = await this.redis.get(newsSentimentCacheKeys(ticker).full);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as NewsSentimentFullPayload;
    } catch {
      return null;
    }
  }

  async setAct(ticker: string, act: "act1" | "act2" | "act3", payload: NarrativeActPayload): Promise<void> {
    const keys = newsSentimentCacheKeys(ticker);
    const ttl =
      act === "act1"
        ? NEWS_SENTIMENT_TTL_SEC.ACT_1_CORE_HISTORY
        : act === "act2"
          ? NEWS_SENTIMENT_TTL_SEC.ACT_2_PRESENT_SENTIMENT
          : NEWS_SENTIMENT_TTL_SEC.ACT_3_SCENARIOS;
    await this.redis.set(keys[act], JSON.stringify(payload), "EX", ttl);
  }

  async setMeta(ticker: string, payload: NewsSentimentMetaPayload): Promise<void> {
    const keys = newsSentimentCacheKeys(ticker);
    await this.redis.set(keys.meta, JSON.stringify(payload), "EX", NEWS_SENTIMENT_TTL_SEC.ACT_3_SCENARIOS);
  }

  async setFull(ticker: string, payload: NewsSentimentFullPayload): Promise<void> {
    const keys = newsSentimentCacheKeys(ticker);
    await this.redis.set(keys.full, JSON.stringify(payload), "EX", NEWS_SENTIMENT_TTL_SEC.ACT_2_PRESENT_SENTIMENT);
  }

  async acquireGenerationLock(ticker: string): Promise<boolean> {
    const result = await this.redis.set(
      newsSentimentCacheKeys(ticker).lock,
      String(Date.now()),
      "EX",
      NEWS_SENTIMENT_LOCK_TTL_SEC,
      "NX",
    );
    return result === "OK";
  }

  async invalidateActs(ticker: string, targets: InvalidationTarget[], reason: string): Promise<InvalidationState> {
    const keys = newsSentimentCacheKeys(ticker);
    const toDelete: string[] = [];
    if (targets.includes("act2")) toDelete.push(keys.act2);
    if (targets.includes("act3")) toDelete.push(keys.act3);
    if (toDelete.length > 0) {
      await this.redis.del(...toDelete, keys.full);
    }

    const existingMeta = await this.getMeta(ticker);
    const nextState: InvalidationState = {
      ...(existingMeta?.invalidationState ?? defaultInvalidationState()),
      act2Invalidated: targets.includes("act2") ? true : (existingMeta?.invalidationState.act2Invalidated ?? false),
      act3Invalidated: targets.includes("act3") ? true : (existingMeta?.invalidationState.act3Invalidated ?? false),
      lastInvalidationReason: reason,
      lastInvalidatedAt: new Date().toISOString(),
    };

    if (existingMeta) {
      await this.setMeta(ticker, {
        ...existingMeta,
        invalidationState: nextState,
        updatedAt: new Date().toISOString(),
      });
    }

    return nextState;
  }

  async evaluateAndInvalidateFromSignals(
    ticker: string,
    signals: {
      intradayChangePct: number;
      earningsEventDetected: boolean;
      ma200Break: boolean;
    },
  ): Promise<InvalidationTarget[]> {
    const targets = new Set<InvalidationTarget>();
    if (shouldInvalidateAct2(signals)) {
      targets.add("act2");
    }
    if (shouldInvalidateAct3(signals)) {
      targets.add("act3");
    }
    if (targets.size === 0) return [];

    const reasons: string[] = [];
    if (signals.intradayChangePct > 3) reasons.push("intraday_price_spike");
    if (signals.earningsEventDetected) reasons.push("earnings_event");
    if (signals.ma200Break) reasons.push("ma200_break");

    await this.invalidateActs(ticker, [...targets], reasons.join(","));
    return [...targets];
  }
}

export const smartNarrativeCacheService = new SmartNarrativeCacheService();
