import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateAnthropicCostUsd } from "../aiCostTelemetry";

describe("estimateAnthropicCostUsd", () => {
  it("estimates Sonnet higher than Haiku for same token counts", () => {
    const sonnet = estimateAnthropicCostUsd("claude-sonnet-4-6", 1000, 500);
    const haiku = estimateAnthropicCostUsd("claude-haiku-4-5", 1000, 500);
    assert.ok(sonnet > haiku);
  });
});
