import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateDividendHealth } from "../scoring";

describe("calculateDividendHealth", () => {
  it("perfect score (all 100) -> 100", () => {
    const out = calculateDividendHealth({
      years_consecutive: 20,
      recent_cuts: 0,
      trend: "rising",
      payout_ratio: 45,
      dividend_yield: 6,
      sector_avg_yield: 4,
      cagr_5y: 10,
    });
    assert.equal(out.score, 100);
  });

  it("zero score (all 0) -> 0", () => {
    const out = calculateDividendHealth({
      years_consecutive: 0,
      recent_cuts: 0,
      trend: "falling",
      payout_ratio: 0,
      dividend_yield: 0,
      sector_avg_yield: 0,
      cagr_5y: 0,
    });
    assert.equal(out.score, 0);
  });

  it("mixed profile continuity 100 and weaker rest -> around 67", () => {
    const out = calculateDividendHealth({
      years_consecutive: 8,
      recent_cuts: 0,
      trend: "stable",
      payout_ratio: 80,
      dividend_yield: 3,
      sector_avg_yield: 5,
      cagr_5y: 3,
    });
    assert.ok(out.score >= 60 && out.score <= 70, `score=${out.score}`);
  });

  it("breakdown contains reasoning string", () => {
    const out = calculateDividendHealth({
      years_consecutive: 10,
      recent_cuts: 1,
      trend: "stable",
      payout_ratio: 68,
      dividend_yield: 4.5,
      sector_avg_yield: 5,
      cagr_5y: 6.2,
    });
    assert.equal(typeof out.breakdown.reasoning, "string");
    assert.match(out.breakdown.reasoning, /^Score \d+ bo: continuity \d+, trend \d+, safety \d+, yield \d+, growth \d+$/);
  });
});
