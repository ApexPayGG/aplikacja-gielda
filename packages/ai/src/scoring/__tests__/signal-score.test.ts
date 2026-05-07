import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreSignal } from "../signal-score";

describe("scoreSignal", () => {
  it("applies weights: technical=100 contributes about 30 points", () => {
    const out = scoreSignal({
      technical: 100,
      history: 0,
      sentiment: 0,
      fundamentals: 0,
      macro: 0,
    });
    assert.equal(out.score, 30);
  });

  it("calculates final weighted score for all factors", () => {
    const out = scoreSignal({
      technical: 80,
      history: 65,
      sentiment: 70,
      fundamentals: 75,
      macro: 60,
    });
    // 80*0.30 + 65*0.30 + 70*0.20 + 75*0.15 + 60*0.05 = 71.75 -> 72
    assert.equal(out.score, 72);
  });

  it("throws validation error when any field is out of range", () => {
    assert.throws(
      () =>
        scoreSignal({
          technical: 101,
          history: 50,
          sentiment: 50,
          fundamentals: 50,
          macro: 50,
        }),
      /Invalid technical: expected number in range 0-100/,
    );
  });

  it("returns reasoning in expected format", () => {
    const out = scoreSignal({
      technical: 80,
      history: 65,
      sentiment: 70,
      fundamentals: 75,
      macro: 60,
    });
    assert.equal(
      out.reasoning,
      "Score 72 bo: technical 80, history 65, sentiment 70, fundamentals 75, macro 60",
    );
    assert.match(out.reasoning, /^Score \d+ bo: technical \d+, history \d+, sentiment \d+, fundamentals \d+, macro \d+$/);
  });
});
