import { isRedisConfigured } from "../config/redis";
import { getCacheRedis } from "../redis";

export async function cacheJsonGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  try {
    const raw = await getCacheRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheJsonSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getCacheRedis().set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore cache failures */
  }
}
