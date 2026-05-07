import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ClaudeClient } from "../../../../../../packages/ai/src/claude/client";

describe("ClaudeClient", () => {
  it("generates signal brief from Anthropic response", async () => {
    const client = new ClaudeClient({
      anthropic: {
        messages: {
          create: async () => ({
            content: [{ type: "text", text: "PL: Silny sygnal.\nEN: Strong setup." }],
          }),
        },
      },
    });

    const brief = await client.generateSignalBrief({
      ticker: "AAPL",
      pattern_type: "supportBounce",
      confidence: 85,
      rsi: 48.2,
      macd: 1.2,
      volume_ratio: 2.3,
      support_level: 184.4,
      price_position: 0.62,
      historical_count: 31,
      win_rate: 63.7,
      avg_return_10d: 2.4,
      max_drawdown: 5.8,
      recent_news: ["Apple expands buyback program"],
      market_sentiment: "neutral",
      sector_trend: "up",
      vix: 17.1,
    });

    assert.equal(brief, "PL: Silny sygnal.\nEN: Strong setup.");
  });

  it("parses score response to integer 0-100", async () => {
    const client = new ClaudeClient({
      anthropic: {
        messages: {
          create: async () => ({
            content: [{ type: "text", text: "Final score: 78/100" }],
          }),
        },
      },
    });

    const score = await client.scoreSignal({
      technical: 70,
      history: 80,
      sentiment: 65,
      fundamentals: 72,
      macro: 60,
    });

    assert.equal(score, 78);
  });
});
