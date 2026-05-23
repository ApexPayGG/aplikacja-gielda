import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNewsItemRelevantToTicker } from "./newsSentiment.providers";

type TestNewsItem = {
  headline: string;
  source: string;
  datetime: number;
  providerMetadata?: Record<string, unknown>;
};

function makeNewsItem(headline: string, providerMetadata?: Record<string, unknown>): TestNewsItem {
  return {
    headline,
    source: "test",
    datetime: 1_700_000_000_000,
    ...(providerMetadata ? { providerMetadata } : {}),
  };
}

describe("newsSentiment.providers ticker-aware filtering", () => {
  it("AAPL accepts headline containing Apple alias", () => {
    const item = makeNewsItem("Apple Inc. durable growth narrative strengthens");
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), true);
  });

  it("AAPL accepts exact ticker token in headline", () => {
    const item = makeNewsItem("AAPL rises after services revenue update");
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), true);
  });

  it("AAPL rejects unrelated Intel headline even when metadata contains AAPL", () => {
    const item = makeNewsItem(
      "Intel beats expectations after AI chip demand improves",
      { related: "AAPL,INTC" },
    );
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), false);
  });

  it("AAPL rejects American Express headline even when metadata contains AAPL", () => {
    const item = makeNewsItem(
      "American Express is still a top Buffett stock",
      { related: "AAPL,AXP" },
    );
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), false);
  });

  it("AAPL rejects CDL headline even when metadata contains AAPL", () => {
    const item = makeNewsItem("CDL annual dividend beats Treasury yields", { related: "AAPL" });
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), false);
  });

  it("AAPL rejects Magnificent Seven headline without Apple/AAPL signal", () => {
    const item = makeNewsItem(
      "This Magnificent Seven stock is the worst performer of 2026",
      { related: "AAPL" },
    );
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), false);
  });

  it("AAPL allows Microsoft comparison when Apple/AAPL is also present", () => {
    const item = makeNewsItem("Apple vs Microsoft heading into H2 2026", { related: "AAPL,MSFT" });
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), true);
  });

  it("AAPL rejects Microsoft headline without Apple/AAPL signal", () => {
    const item = makeNewsItem("Microsoft becomes the market's biggest AI drag", { related: "AAPL,MSFT" });
    assert.equal(isNewsItemRelevantToTicker(item, "AAPL"), false);
  });
});
