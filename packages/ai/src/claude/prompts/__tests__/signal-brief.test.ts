import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSignalBriefPrompt } from "../signal-brief";

describe("buildSignalBriefPrompt", () => {
  it("contains key metrics and PL/EN output markers", () => {
    const prompt = buildSignalBriefPrompt({
      ticker: "AAPL",
      pattern_type: "supportBounce",
      confidence: 85,
      rsi: 47.2,
      macd: 1.1,
      volume_ratio: 2.3,
      support_level: 184.4,
      price_position: 0.63,
      historical_count: 29,
      win_rate: 62.5,
      avg_return_10d: 2.8,
      max_drawdown: 4.9,
      recent_news: ["Apple reports stronger iPhone demand"],
      market_sentiment: "neutral",
      sector_trend: "up",
      vix: 18.4,
    });

    assert.match(prompt, /ticker:\s*AAPL/);
    assert.match(prompt, /confidence:\s*85/);
    assert.match(prompt, /win_rate:\s*62\.5%/);
    assert.match(prompt, /=== PL ===/);
    assert.match(prompt, /=== EN ===/);
  });
});
