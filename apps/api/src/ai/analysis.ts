import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { getCacheRedis } from "../redis";
import { getLatestIndicator, getLatestQuote, getRecentNews } from "../db/queries";

const CACHE_PREFIX = "analysis:";
const CACHE_TTL_SEC = 3600;
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

/**
 * Claude Sonnet brief + Redis cache (1 hour).
 */
export async function analyzeStock(symbol: string): Promise<AnalysisResult> {
  const sym = symbol.toUpperCase();
  const cacheKey = `${CACHE_PREFIX}${sym}`;
  const redis = getCacheRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as AnalysisResult;
      if (parsed.brief && parsed.updatedAt) return parsed;
    } catch {
      /* fall through */
    }
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(sym, quoteJson, newsTitles, rsi) }],
  });

  const block = msg.content[0];
  const brief = block.type === "text" ? block.text : "";
  const updatedAt = new Date().toISOString();
  const out: AnalysisResult = { brief, updatedAt };

  await redis.set(cacheKey, JSON.stringify(out), "EX", CACHE_TTL_SEC);
  return out;
}
