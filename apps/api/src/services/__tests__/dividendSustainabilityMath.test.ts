import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSustainabilityBreakdownFromInputs,
  computeYoYGrowthFromDpsSeries,
} from "../dividendSustainabilityMath";

describe("dividendSustainabilityMath", () => {
  it("a) safe dividend: low payout, strong FCF, stable history → high score (~90)", () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const dps = [2.0, 2.1, 2.15, 2.2, 2.25];
    const input = {
      epsTtm: 10,
      latestAnnualDps: 3.2,
      fcf: 1e12,
      sharesOutstanding: 1e9,
      dividendTotalsByYear: years.map((year, i) => ({ year, totalAmount: dps[i]! })),
    };
    const b = computeSustainabilityBreakdownFromInputs(input);
    assert.equal(b.payoutScore, 90);
    assert.equal(b.coverageScore, 100);
    assert.equal(b.consistencyScore, 100);
    assert.ok(b.finalScore >= 95 && b.finalScore <= 97, `finalScore=${b.finalScore}`);
    assert.ok(b.payoutRatio !== null && Math.abs(b.payoutRatio - 0.32) < 1e-6);
    assert.ok(b.fcfCoverage !== null && b.fcfCoverage < 0.01);
  });

  it("b) risky dividend: high payout, weak FCF, multiple cuts → low score (~20)", () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const dps = [10, 5, 8, 6, 7];
    const b = computeSustainabilityBreakdownFromInputs({
      epsTtm: 8,
      latestAnnualDps: 6,
      fcf: 7.5e9,
      sharesOutstanding: 2e9,
      dividendTotalsByYear: years.map((year, i) => ({ year, totalAmount: dps[i]! })),
    });
    assert.equal(b.payoutScore, 40);
    assert.equal(b.coverageScore, 0);
    assert.equal(b.consistencyScore, 30);
    assert.ok(b.finalScore >= 8 && b.finalScore <= 28, `finalScore=${b.finalScore}`);
  });

  it("c) missing FCF → coverage 50 and explanation mentions FCF", () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const dps = [1, 1.05, 1.08, 1.1, 1.12];
    const b = computeSustainabilityBreakdownFromInputs({
      epsTtm: 4,
      latestAnnualDps: 1.12,
      fcf: null,
      sharesOutstanding: 1e9,
      dividendTotalsByYear: years.map((year, i) => ({ year, totalAmount: dps[i]! })),
    });
    assert.equal(b.coverageScore, 50);
    assert.ok(b.explanation.includes("FCF"));
    assert.equal(b.fcfCoverage, null);
    assert.ok(b.finalScore > 70);
  });

  it("d) one year of DPS → partial consistency, rest computed", () => {
    const b = computeSustainabilityBreakdownFromInputs({
      epsTtm: 10,
      latestAnnualDps: 2,
      fcf: 100e9,
      sharesOutstanding: 1e9,
      dividendTotalsByYear: [{ year: 2025, totalAmount: 2 }],
    });
    assert.deepEqual(b.dpsHistory, [2]);
    assert.deepEqual(b.yoyGrowth, []);
    assert.equal(b.consistencyScore, 70);
    assert.equal(b.payoutScore, 100);
    assert.ok(b.finalScore >= 80);
  });

  it("computeYoYGrowthFromDpsSeries", () => {
    const g = computeYoYGrowthFromDpsSeries([100, 110, 99]);
    assert.ok(Math.abs(g[0]! - 10) < 1e-9);
    assert.ok(Math.abs(g[1]! - (-11 / 110) * 100) < 1e-9);
  });
});
