import type { NextFunction, Request, Response } from "express";
import process from "node:process";
import { isRedisConfigured } from "../config/redis";
import { getCacheRedis } from "../redis";

function parseRedisInfo(info: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of info.split("\r\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

/**
 * GET /api/redis/stats — memory, evictions, hit/miss (diagnostics).
 * If REDIS_STATS_SECRET is set, require header X-Redis-Stats-Secret.
 */
export async function redisStatsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const secret = process.env.REDIS_STATS_SECRET?.trim();
    if (secret) {
      const provided = String(req.headers["x-redis-stats-secret"] ?? "");
      if (provided !== secret) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    if (!isRedisConfigured()) {
      res.status(503).json({ error: "Redis not configured (REDIS_URL)" });
      return;
    }

    const redis = getCacheRedis();
    const raw = await redis.info();
    const p = parseRedisInfo(raw);

    const hits = parseInt(p.keyspace_hits ?? "0", 10);
    const misses = parseInt(p.keyspace_misses ?? "0", 10);
    const hm = hits + misses;
    const hitRate = hm > 0 ? hits / hm : null;

    res.json({
      redisVersion: p.redis_version,
      connectedClients: parseInt(p.connected_clients ?? "0", 10),
      usedMemoryBytes: parseInt(p.used_memory ?? "0", 10),
      usedMemoryHuman: p.used_memory_human,
      usedMemoryPeakHuman: p.used_memory_peak_human,
      maxMemoryBytes: parseInt(p.maxmemory ?? "0", 10),
      maxMemoryPolicy: p.maxmemory_policy,
      memFragmentationRatio: p.mem_fragmentation_ratio,
      evictedKeys: parseInt(p.evicted_keys ?? "0", 10),
      expiredKeys: parseInt(p.expired_keys ?? "0", 10),
      keyspaceHits: hits,
      keyspaceMisses: misses,
      keyspaceHitRate: hitRate,
      totalCommandsProcessed: parseInt(p.total_commands_processed ?? "0", 10),
      uptimeSeconds: parseInt(p.uptime_in_seconds ?? "0", 10),
    });
  } catch (e) {
    next(e);
  }
}
