import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSnapshotFeatures, calculateRsi14 } from "./snapshotJob";

describe("snapshot job feature engineering", () => {
  it("calculates RSI14 in bullish range for rising closes", () => {
    const closes = [115, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101];
    const rsi = calculateRsi14(closes);
    assert.ok(rsi > 70);
    assert.ok(rsi <= 100);
  });

  it("builds a 9-dimensional normalized embedding", () => {
    const quotes = Array.from({ length: 30 }).map((_, idx) => {
      const close = 140 - idx * 1.2;
      const high = close * 1.02;
      const low = close * 0.98;
      const volume = BigInt(1_000_000 + (idx % 7) * 50_000);
      return { close, high, low, volume };
    });

    const features = buildSnapshotFeatures(
      quotes.map((q) => ({
        close: q.close,
        high: q.high,
        low: q.low,
        volume: Number(q.volume),
      })),
    );

    assert.ok(features);
    assert.equal(features?.embedding.length, 9);
    for (const value of features?.embedding ?? []) {
      assert.ok(value >= -1);
      assert.ok(value <= 1);
    }
  });
});
