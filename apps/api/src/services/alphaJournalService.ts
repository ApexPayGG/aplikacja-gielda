import { getCacheRedis } from "../redis";

export type AlphaJournalEntry = {
  ts: string;
  feature: string;
  symbol: string;
  impactScore: number;
  details: string;
  metadata?: Record<string, unknown>;
};

const ALPHA_JOURNAL_KEY = "alpha_journal:events";
const ALPHA_JOURNAL_MAX = 500;

export async function recordAlphaJournalEvent(entry: AlphaJournalEntry): Promise<void> {
  try {
    const redis = getCacheRedis();
    await redis.lpush(ALPHA_JOURNAL_KEY, JSON.stringify(entry));
    await redis.ltrim(ALPHA_JOURNAL_KEY, 0, ALPHA_JOURNAL_MAX - 1);
  } catch {
    // non-blocking telemetry channel
  }
}

export async function getAlphaJournalEvents(limit = 50): Promise<AlphaJournalEntry[]> {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  try {
    const redis = getCacheRedis();
    const rows = await redis.lrange(ALPHA_JOURNAL_KEY, 0, safeLimit - 1);
    return rows
      .map((raw) => {
        try {
          return JSON.parse(raw) as AlphaJournalEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is AlphaJournalEntry => Boolean(x));
  } catch {
    return [];
  }
}
