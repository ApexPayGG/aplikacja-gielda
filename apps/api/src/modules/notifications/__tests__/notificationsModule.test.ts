import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDiscordSignalEmbed,
  buildTelegramSignalMessage,
  sendSignalAlert,
  type NotificationSignalPayload,
  type UserNotificationPreferences,
} from "../notificationsModule";

describe("notifications module", () => {
  const signal: NotificationSignalPayload = {
    ticker: "AAPL",
    setupType: "Breakout",
    riskScore: 82,
    entry: 192.45,
    stopLoss: 186.1,
    takeProfit: 205.8,
    winRate: 64.2,
  };

  it("builds discord embed with brandDark and required fields", () => {
    const embed = buildDiscordSignalEmbed(signal);
    assert.equal(embed.title, "AAPL — Breakout | Score: 82");
    assert.equal(embed.color, 0x2d0a6b);
    assert.equal(embed.footer?.text, "StockAI Pro");
    assert.deepEqual(
      embed.fields?.map((f) => f.name),
      ["Entry", "SL", "TP", "Win Rate"],
    );
  });

  it("builds telegram message with emoji formatting", () => {
    const message = buildTelegramSignalMessage(signal);
    assert.match(message, /📈/);
    assert.match(message, /🎯 Entry:/);
    assert.match(message, /🛡️ SL:/);
    assert.match(message, /✅ Win Rate:/);
    assert.match(message, /AAPL — Breakout/);
  });

  it("sends discord embed and telegram message for enabled preferences", async () => {
    const prefs: UserNotificationPreferences = {
      discordWebhook: "https://discord.com/api/webhooks/demo/123",
      telegramChatId: "987654321",
      notifySignals: true,
      notifyDividends: true,
      minSignalScore: 70,
    };
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchFn = async (input: string, init?: RequestInit) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        text: async () => "",
      };
    };

    const result = await sendSignalAlert(signal, prefs, { fetchFn, telegramBotToken: "tg-token" });

    assert.equal(result.discordSent, true);
    assert.equal(result.telegramSent, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.input, "https://discord.com/api/webhooks/demo/123");
    assert.equal(calls[1]?.input, "https://api.telegram.org/bottg-token/sendMessage");
  });

  it("skips notification delivery when score is below user minimum", async () => {
    const prefs: UserNotificationPreferences = {
      discordWebhook: "https://discord.com/api/webhooks/demo/123",
      telegramChatId: "987654321",
      notifySignals: true,
      notifyDividends: true,
      minSignalScore: 90,
    };
    let called = false;
    const fetchFn = async (_input: string, _init?: RequestInit) => {
      called = true;
      return {
        ok: true,
        status: 200,
        text: async () => "",
      };
    };
    const result = await sendSignalAlert(signal, prefs, { fetchFn, telegramBotToken: "tg-token" });
    assert.equal(result.discordSent, false);
    assert.equal(result.telegramSent, false);
    assert.equal(called, false);
  });
});
