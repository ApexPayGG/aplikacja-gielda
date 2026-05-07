import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { getLatestIndicator, getLatestQuote, getRecentNews } from "../db/queries";
import { getCacheRedis } from "../redis";
const MODEL = "claude-sonnet-4-6";

export type AnalysisResult = {
  brief: string;
  updatedAt: string;
};

function buildPrompt(symbol: string, quoteJson: unknown, newsTitles: string[], rsi: string | null): string {
  return `Analyze ${symbol} based on the following context.

Latest quote (DB): ${JSON.stringify(quoteJson)}
Recent news headlines: ${newsTitles.join(" | ") || "(none)"}
Latest RSI (if any): ${rsi ?? "(none)"}

Provide a brief investment-style note in two sections:
1) Polish (2–4 short paragraphs)
2) English (2–4 short paragraphs)

Be concise and clearly label "PL:" and "EN:" sections. This is not personalized financial advice.`;
}

async function readAnalysisCache(cacheKey: string): Promise<AnalysisResult | null> {
  if (!process.env.REDIS_URL?.trim()) return null;
  try {
    const redis = getCacheRedis();
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as AnalysisResult;
    if (parsed.brief && parsed.updatedAt) return parsed;
  } catch {
    /* Redis down or bad payload */
  }
  return null;
}

async function writeAnalysisCache(cacheKey: string, payload: string): Promise<void> {
  if (!process.env.REDIS_URL?.trim()) return;
  try {
    const redis = getCacheRedis();
    await redis.set(cacheKey, payload, "EX", REDIS_TTL_SEC.AI_ANALYSIS);
  } catch {
    /* ignore cache write failures */
  }
}

/**
 * Claude Sonnet brief + optional Redis cache (1 hour) when REDIS_URL is set.
 */
export async function analyzeStock(symbol: string): Promise<AnalysisResult> {
  const sym = symbol.toUpperCase();
  const cacheKey = redisKeys.analysisBrief(sym);

  const cached = await readAnalysisCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add your Anthropic API key to apps/api/.env to enable the AI brief.",
    );
  }

  const [quote, news, rsiRow] = await Promise.all([
    getLatestQuote(sym),
    getRecentNews(sym, 10),
    getLatestIndicator(sym, "RSI"),
  ]);

  const quoteJson = quote
    ? {
        timestamp: quote.timestamp.toISOString(),
        close: quote.close.toString(),
        volume: quote.volume.toString(),
        source: quote.source,
      }
    : null;

  const newsTitles = news.map((n) => n.title);
  const rsi = rsiRow ? rsiRow.value.toString() : null;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(sym, quoteJson, newsTitles, rsi) }],
  });

  const block = msg.content[0];
  const brief = block.type === "text" ? block.text : "";
  const updatedAt = new Date().toISOString();
  const out: AnalysisResult = { brief, updatedAt };

  await writeAnalysisCache(cacheKey, JSON.stringify(out));
  return out;
}
