import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseIntent, setIntentParserAnthropicClient } from "../intent-parser";

function mockClientWithText(text: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text }],
      }),
    },
  };
}

afterEach(() => {
  setIntentParserAnthropicClient(null);
});

describe("parseIntent", () => {
  it("parses Polish query: Szukam breakout'ów na GPW", async () => {
    setIntentParserAnthropicClient(
      mockClientWithText(
        JSON.stringify({
          market: ["GPW"],
          pattern: "breakout",
          filters: {},
        }),
      ) as never,
    );

    const out = await parseIntent("Szukam breakout'ów na GPW");
    assert.deepEqual(out.market, ["GPW"]);
    assert.equal(out.pattern, "breakout");
  });

  it("parses English query: Tech stocks with high dividend", async () => {
    setIntentParserAnthropicClient(
      mockClientWithText(
        JSON.stringify({
          market: ["NYSE", "NASDAQ"],
          pattern: "dividend_growth",
          filters: { sector: "Technology" },
        }),
      ) as never,
    );

    const out = await parseIntent("Tech stocks with high dividend");
    assert.deepEqual(out.market, ["NYSE", "NASDAQ"]);
    assert.equal(out.pattern, "dividend_growth");
  });

  it("parses filters: DY > 4%, payout < 70%", async () => {
    setIntentParserAnthropicClient(
      mockClientWithText(
        JSON.stringify({
          market: ["GPW"],
          pattern: "dividend_growth",
          filters: {
            dy_min: 4,
            payout_ratio_max: 70,
          },
        }),
      ) as never,
    );

    const out = await parseIntent("DY > 4%, payout < 70%");
    assert.equal(out.filters.dy_min, 4);
    assert.equal(out.filters.payout_ratio_max, 70);
  });

  it("throws for invalid pattern", async () => {
    setIntentParserAnthropicClient(
      mockClientWithText(
        JSON.stringify({
          market: ["GPW"],
          pattern: "random_pattern",
          filters: {},
        }),
      ) as never,
    );

    await assert.rejects(() => parseIntent("invalid"), /Invalid pattern/);
  });
});
