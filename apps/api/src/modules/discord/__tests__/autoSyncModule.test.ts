import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiscordCloseMessage, buildDiscordOpenMessage } from "../autoSyncModule";

describe("discord auto-sync message builders", () => {
  it("builds open message in required format", () => {
    const content = buildDiscordOpenMessage({
      symbol: "AAPL",
      price: 192.34,
      stopLoss: 180,
      takeProfit: 205.5,
    });
    assert.match(content, /📈 \*\*Otworzyłem pozycję\*\*/);
    assert.match(content, /Symbol: AAPL \| Cena: 192\.34/);
    assert.match(content, /Stop Loss: 180\.00 \| Take Profit: 205\.50/);
    assert.match(content, /via StockAI Pro 🤖/);
  });

  it("builds close message in required format", () => {
    const content = buildDiscordCloseMessage({
      symbol: "NVDA",
      pnlPct: 5.127,
      holdingDays: 3,
    });
    assert.match(content, /📊 \*\*Zamknąłem pozycję\*\*/);
    assert.match(content, /Symbol: NVDA \| Wynik: 5\.13%/);
    assert.match(content, /Czas trzymania: 3 dni/);
    assert.match(content, /via StockAI Pro 🤖/);
  });
});
