import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";

export interface ParsedIntent {
  market: string[];
  pattern: string;
  filters: {
    sector?: string;
    dy_min?: number;
    dy_max?: number;
    payout_ratio_max?: number;
    trend?: "rising" | "stable" | "falling";
    market_cap_min?: number;
    years_of_dividend?: number;
  };
  timeframe?: string;
  additional_context?: string;
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

type AnthropicLike = {
  messages: {
    create: (args: Record<string, unknown>) => Promise<{ content: AnthropicTextBlock[] }>;
  };
};

const INTENT_MODEL = "claude-4-5-haiku";
const PATTERN_WHITELIST = new Set([
  "breakout",
  "support_bounce",
  "macd_cross",
  "bollinger",
  "overreaction",
  "momentum",
  "dividend_growth",
  "earnings_play",
]);

export const intentParserLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "intent_parser" },
});

let anthropicOverride: AnthropicLike | null = null;

export function setIntentParserAnthropicClient(client: AnthropicLike | null): void {
  anthropicOverride = client;
}

function getAnthropicClient(): AnthropicLike {
  if (anthropicOverride) return anthropicOverride;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Claude Haiku unavailable: ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey }) as unknown as AnthropicLike;
}

function extractText(content: AnthropicTextBlock[]): string {
  const block = content.find((b) => b.type === "text");
  return (block?.text ?? "").trim();
}

function extractJsonString(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude response does not contain valid JSON object");
  }
  return text.slice(start, end + 1);
}

function validateAndNormalizeIntent(raw: unknown): ParsedIntent {
  const obj = (raw ?? {}) as Partial<ParsedIntent>;
  const market =
    Array.isArray(obj.market) && obj.market.length > 0
      ? obj.market.map((m) => String(m).trim()).filter(Boolean)
      : ["GPW", "NYSE"];

  const pattern = String(obj.pattern ?? "").trim();
  if (!PATTERN_WHITELIST.has(pattern)) {
    throw new Error(`Invalid pattern "${pattern}". Allowed: ${[...PATTERN_WHITELIST].join(", ")}`);
  }

  const filtersRaw = (obj.filters ?? {}) as Record<string, unknown>;
  const filters: ParsedIntent["filters"] = {
    ...(typeof filtersRaw.sector === "string" ? { sector: filtersRaw.sector } : {}),
    ...(Number.isFinite(Number(filtersRaw.dy_min)) ? { dy_min: Number(filtersRaw.dy_min) } : {}),
    ...(Number.isFinite(Number(filtersRaw.dy_max)) ? { dy_max: Number(filtersRaw.dy_max) } : {}),
    ...(Number.isFinite(Number(filtersRaw.payout_ratio_max))
      ? { payout_ratio_max: Number(filtersRaw.payout_ratio_max) }
      : {}),
    ...(filtersRaw.trend === "rising" || filtersRaw.trend === "stable" || filtersRaw.trend === "falling"
      ? { trend: filtersRaw.trend }
      : {}),
    ...(Number.isFinite(Number(filtersRaw.market_cap_min))
      ? { market_cap_min: Number(filtersRaw.market_cap_min) }
      : {}),
    ...(Number.isFinite(Number(filtersRaw.years_of_dividend))
      ? { years_of_dividend: Number(filtersRaw.years_of_dividend) }
      : {}),
  };

  return {
    market,
    pattern,
    filters,
    ...(typeof obj.timeframe === "string" && obj.timeframe.trim() ? { timeframe: obj.timeframe.trim() } : {}),
    ...(typeof obj.additional_context === "string" && obj.additional_context.trim()
      ? { additional_context: obj.additional_context.trim() }
      : {}),
  };
}

export async function parseIntent(query: string): Promise<ParsedIntent> {
  if (!query.trim()) {
    throw new Error("Query cannot be empty");
  }

  const client = getAnthropicClient();
  const maxAttempts = 3; // initial + 2 retries for JSON parse errors

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.messages.create({
        model: INTENT_MODEL,
        max_tokens: 600,
        temperature: 0,
        system:
          "Extract investment intent from query. Return JSON only. Keep schema exact: market, pattern, filters, timeframe, additional_context.",
        messages: [{ role: "user", content: query }],
      });

      const text = extractText(response.content);
      const parsed = JSON.parse(extractJsonString(text)) as unknown;
      const out = validateAndNormalizeIntent(parsed);
      intentParserLogger.info({ msg: "intent_parsed", query, pattern: out.pattern, markets: out.market });
      return out;
    } catch (error) {
      const isJsonFailure =
        error instanceof Error &&
        (error.message.includes("JSON") || error.message.includes("valid JSON object"));

      intentParserLogger.warn({
        msg: "intent_parse_attempt_failed",
        attempt,
        isJsonFailure,
        err: error instanceof Error ? error.message : String(error),
      });

      if (!isJsonFailure || attempt >= maxAttempts) {
        if (error instanceof Error && error.message.includes("unavailable")) {
          throw error;
        }
        if (!isJsonFailure) {
          throw new Error(
            `Claude Haiku unavailable: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw new Error("Intent parsing failed");
}
