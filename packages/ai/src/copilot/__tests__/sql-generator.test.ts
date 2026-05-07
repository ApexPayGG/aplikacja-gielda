import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedIntent } from "../intent-parser";
import { generateSQL } from "../sql-generator";

function baseIntent(): ParsedIntent {
  return {
    market: ["GPW"],
    pattern: "breakout",
    filters: {},
  };
}

describe("generateSQL", () => {
  it("single market uses WHERE s.exchange = ?", () => {
    const out = generateSQL(baseIntent());
    assert.match(out.query, /WHERE s\.exchange = \?/);
    assert.deepEqual(out.params, ["GPW", "breakout"]);
  });

  it("multiple markets use WHERE s.exchange IN (?, ?)", () => {
    const out = generateSQL({
      ...baseIntent(),
      market: ["GPW", "NYSE"],
    });
    assert.match(out.query, /s\.exchange IN \(\?, \?\)/);
    assert.deepEqual(out.params.slice(0, 3), ["GPW", "NYSE", "breakout"]);
  });

  it("pattern filter includes s.pattern_type = ?", () => {
    const out = generateSQL({
      ...baseIntent(),
      pattern: "breakout",
    });
    assert.match(out.query, /s\.pattern_type = \?/);
    assert.equal(out.params[1], "breakout");
  });

  it("multiple filters build correct WHERE clauses", () => {
    const out = generateSQL({
      market: ["GPW", "NYSE"],
      pattern: "breakout",
      filters: {
        dy_min: 4,
      },
    });
    assert.match(out.query, /s\.exchange IN \(\?, \?\)/);
    assert.match(out.query, /s\.pattern_type = \?/);
    assert.match(out.query, /d\.dividend_yield >= \?/);
  });

  it("keeps params array in placeholder order", () => {
    const out = generateSQL({
      market: ["GPW", "NYSE"],
      pattern: "dividend_growth",
      filters: {
        sector: "Technology",
        dy_min: 4,
        dy_max: 8,
        payout_ratio_max: 70,
        trend: "rising",
        market_cap_min: 1_000_000_000,
        years_of_dividend: 10,
      },
      timeframe: "long_term",
    });

    assert.deepEqual(out.params, [
      "GPW",
      "NYSE",
      "dividend_growth",
      "Technology",
      4,
      8,
      70,
      "rising",
      1_000_000_000,
      10,
    ]);
  });

  it("throws error for invalid exchange", () => {
    assert.throws(
      () =>
        generateSQL({
          market: ["INVALID_EXCHANGE"],
          pattern: "breakout",
          filters: {},
        }),
      /Invalid exchange/,
    );
  });
});
