import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeIntradayChangePct,
  computeMa200,
  detectEarningsEventFromHeadlines,
  detectMa200Break,
  resolveInvalidationTargets,
  shouldInvalidateAct2,
  shouldInvalidateAct3,
} from "./smartNarrativeCache.service";

describe("SmartNarrativeCache invalidation logic", () => {
  it("invalidates ACT_2 on intraday spike above 3%", () => {
    assert.equal(shouldInvalidateAct2({ intradayChangePct: 3.01, earningsEventDetected: false }), true);
    assert.equal(shouldInvalidateAct2({ intradayChangePct: 2.99, earningsEventDetected: false }), false);
  });

  it("invalidates ACT_2 on earnings event", () => {
    assert.equal(shouldInvalidateAct2({ intradayChangePct: 0.5, earningsEventDetected: true }), true);
  });

  it("invalidates ACT_3 when price breaks MA200", () => {
    assert.equal(shouldInvalidateAct3({ ma200Break: true }), true);
    assert.equal(shouldInvalidateAct3({ ma200Break: false }), false);
    assert.equal(detectMa200Break(95, 100, 105), true);
    assert.equal(detectMa200Break(105, 100, 95), true);
    assert.equal(detectMa200Break(105, 100, 104), false);
  });

  it("detects earnings headlines", () => {
    assert.equal(
      detectEarningsEventFromHeadlines(["Company beats Q1 2026 earnings expectations"]),
      true,
    );
    assert.equal(detectEarningsEventFromHeadlines(["Company opens new office"]), false);
  });

  it("maps invalidation reasons to cache targets", () => {
    assert.deepEqual(resolveInvalidationTargets("intraday_price_spike"), ["act2"]);
    assert.deepEqual(resolveInvalidationTargets("earnings_event"), ["act2"]);
    assert.deepEqual(resolveInvalidationTargets("ma200_break"), ["act3"]);
    assert.deepEqual(resolveInvalidationTargets("manual"), ["act2", "act3"]);
  });

  it("computes MA200 and intraday change pct", () => {
    const closes = Array.from({ length: 200 }, (_, index) => 100 + index * 0.1);
    const ma200 = computeMa200(closes);
    assert.ok(ma200 != null && ma200 > 100);
    assert.ok(Math.abs(computeIntradayChangePct(103.5, 100) - 3.5) < 1e-9);
  });
});
