import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectStressSignals,
  getEmotionalLevel,
  type EmotionalTrackInput,
} from "./emotionalStateDetector";

describe("emotionalStateDetector", () => {
  it("detects stress when click rate exceeds threshold", () => {
    const input: EmotionalTrackInput = {
      userId: "u1",
      clickRate: 41,
      tradeFrequency: 2,
      avgDecisionTime: 6,
    };
    const result = detectStressSignals(input);
    assert.equal(result.stressDetected, true);
    assert.equal(result.triggeredBy.clickRate, true);
    assert.equal(getEmotionalLevel(result), "MEDIUM");
  });

  it("returns HIGH level when two or more stress signals trigger", () => {
    const input: EmotionalTrackInput = {
      userId: "u2",
      clickRate: 55,
      tradeFrequency: 9,
      avgDecisionTime: 2,
    };
    const result = detectStressSignals(input);
    assert.equal(result.stressDetected, true);
    assert.equal(result.triggerCount, 3);
    assert.equal(getEmotionalLevel(result), "HIGH");
  });

  it("returns LOW level when no stress thresholds are met", () => {
    const input: EmotionalTrackInput = {
      userId: "u3",
      clickRate: 10,
      tradeFrequency: 1,
      avgDecisionTime: 8,
    };
    const result = detectStressSignals(input);
    assert.equal(result.stressDetected, false);
    assert.equal(result.triggerCount, 0);
    assert.equal(getEmotionalLevel(result), "LOW");
  });
});
