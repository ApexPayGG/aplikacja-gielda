import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DiscordBot } from "../discord";

function createBot(calls: Array<{ url: string; init?: RequestInit }>) {
  return new DiscordBot(
    "token_123",
    "guild_1",
    {
      signals_gpw: "c1",
      signals_us: "c2",
      paper_trading: "c3",
      results: "c4",
      vip_signals: "c5",
    },
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => "",
      };
    },
  );
}

describe("DiscordBot", () => {
  it("sendSignal creates embed and sets color", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const bot = createBot(calls);
    await bot.sendSignal("signals_gpw", {
      ticker: "AAPL",
      score: 75,
      brief_pl: "Test brief",
      pattern: "breakout",
      confidence: 88,
    });

    assert.equal(calls.length, 1);
    const body = JSON.parse(String(calls[0]?.init?.body ?? "{}"));
    assert.ok(Array.isArray(body.embeds));
    assert.equal(body.embeds[0].color, 0x22c55e);
    assert.match(String(calls[0]?.url), /channels\/c1\/messages/);
  });

  it("sendPaperTradeUpdate formats SELL with pnl", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const bot = createBot(calls);
    await bot.sendPaperTradeUpdate("user_1", {
      ticker: "AAPL",
      side: "SELL",
      quantity: 10,
      price: 155,
      pnl_pct: 3.3,
    });

    const body = JSON.parse(String(calls[0]?.init?.body ?? "{}"));
    assert.match(body.content, /sold 10 AAPL @ \$155 \(\+3.3%\)/);
    assert.match(String(calls[0]?.url), /channels\/c3\/messages/);
  });

  it("sendWeeklyResults includes stats", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const bot = createBot(calls);
    await bot.sendWeeklyResults({
      total_signals: 45,
      win_rate: 67,
      avg_return: 5.8,
    });

    const body = JSON.parse(String(calls[0]?.init?.body ?? "{}"));
    assert.match(body.content, /Weekly: 45 signals, 67% win rate, \+5.8% avg/);
    assert.match(String(calls[0]?.url), /channels\/c4\/messages/);
  });
});
