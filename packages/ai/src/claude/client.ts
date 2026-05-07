import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";

export interface SignalBriefInput {
  ticker: string;
  pattern_type: string;
  confidence: number;
  rsi: number;
  macd: number;
  volume_ratio: number;
  support_level: number;
  price_position: number;
  historical_count: number;
  win_rate: number;
  avg_return_10d: number;
  max_drawdown: number;
  recent_news: string[];
  market_sentiment: string;
  sector_trend: string;
  vix: number;
}

export interface ScoringInput {
  technical: number;
  history: number;
  sentiment: number;
  fundamentals: number;
  macro: number;
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

const SYSTEM_PROMPT =
  "You are expert investment analyst. Provide concise, factual signal interpretation, highlight uncertainty, and avoid personalized financial advice.";
const BRIEF_MODEL = "claude-sonnet-4-6";
const SCORE_MODEL = "claude-sonnet-4-6";

export const claudeClientLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "claude_client" },
});

export class ClaudeClient {
  private readonly anthropic: AnthropicLike;

  private readonly maxRetries: number;

  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(input?: {
    anthropic?: AnthropicLike;
    maxRetries?: number;
    sleepFn?: (ms: number) => Promise<void>;
  }) {
    this.maxRetries = input?.maxRetries ?? 3;
    this.sleepFn = input?.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    if (input?.anthropic) {
      this.anthropic = input.anthropic;
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.anthropic = new Anthropic({ apiKey }) as unknown as AnthropicLike;
  }

  async generateSignalBrief(input: SignalBriefInput): Promise<string> {
    const prompt = [
      "Generate a concise signal brief in Polish and English.",
      `Ticker: ${input.ticker}`,
      `Pattern: ${input.pattern_type}`,
      `Confidence: ${input.confidence}`,
      `RSI: ${input.rsi}`,
      `MACD: ${input.macd}`,
      `Volume ratio: ${input.volume_ratio}`,
      `Support level: ${input.support_level}`,
      `Price position: ${input.price_position}`,
      `Historical count: ${input.historical_count}`,
      `Win rate: ${input.win_rate}`,
      `Avg return 10d: ${input.avg_return_10d}`,
      `Max drawdown: ${input.max_drawdown}`,
      `Recent news: ${input.recent_news.join(" | ") || "(none)"}`,
      `Market sentiment: ${input.market_sentiment}`,
      `Sector trend: ${input.sector_trend}`,
      `VIX: ${input.vix}`,
      "Return plain text only.",
    ].join("\n");

    const response = await this.withRetry("generateSignalBrief", () =>
      this.anthropic.messages.create({
        model: BRIEF_MODEL,
        max_tokens: 1024,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const brief = this.extractText(response.content);
    if (!brief) {
      throw new Error("Claude returned empty brief");
    }
    return brief;
  }

  async scoreSignal(input: ScoringInput): Promise<number> {
    const prompt = [
      "Score this investment signal from 0 to 100.",
      "Return ONLY one integer between 0 and 100.",
      `technical=${input.technical}`,
      `history=${input.history}`,
      `sentiment=${input.sentiment}`,
      `fundamentals=${input.fundamentals}`,
      `macro=${input.macro}`,
    ].join("\n");

    const response = await this.withRetry("scoreSignal", () =>
      this.anthropic.messages.create({
        model: SCORE_MODEL,
        max_tokens: 256,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    );

    const text = this.extractText(response.content);
    const score = this.parseScore(text);
    if (score < 0 || score > 100) {
      throw new Error(`Score out of range: ${score}`);
    }
    return score;
  }

  private extractText(content: AnthropicTextBlock[]): string {
    const block = content.find((b) => b.type === "text");
    return (block?.text ?? "").trim();
  }

  private parseScore(value: string): number {
    const match = value.match(/\b(100|[1-9]?\d)\b/);
    if (!match) {
      throw new Error(`Cannot parse score from Claude response: "${value}"`);
    }
    return Number.parseInt(match[1] ?? "", 10);
  }

  private async withRetry<T>(op: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;
    while (attempt < this.maxRetries) {
      attempt += 1;
      try {
        return await fn();
      } catch (error) {
        lastErr = error;
        claudeClientLogger.warn({
          msg: "claude_call_failed",
          op,
          attempt,
          err: error instanceof Error ? error.message : String(error),
        });
        if (attempt >= this.maxRetries) break;
        const backoffMs = 200 * 2 ** (attempt - 1);
        await this.sleepFn(backoffMs);
      }
    }
    claudeClientLogger.error({
      msg: "claude_call_exhausted",
      op,
      attempts: this.maxRetries,
      err: lastErr instanceof Error ? lastErr.message : String(lastErr),
    });
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
