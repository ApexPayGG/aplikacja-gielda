/**
 * Czyści całą bazę Redis pod REDIS_URL (FLUSHDB).
 * Uruchom: REDIS_FLUSH_CONFIRM=YES npx tsx scripts/redis-flushdb.ts
 */
import "../src/load-env";
import process from "node:process";

if (process.env.REDIS_FLUSH_CONFIRM !== "YES") {
  console.error("Refusing FLUSHDB: set REDIS_FLUSH_CONFIRM=YES (wipes current Redis DB).");
  process.exit(1);
}
if (!process.env.REDIS_URL?.trim()) {
  console.error("REDIS_URL is not set.");
  process.exit(1);
}

import { getCacheRedis } from "../src/redis";

await getCacheRedis().flushdb();
console.log("FLUSHDB completed.");
process.exit(0);
