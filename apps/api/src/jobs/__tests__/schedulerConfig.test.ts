import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipRealtimeMarketIngest } from "../schedulerConfig";

describe("shouldSkipRealtimeMarketIngest", () => {
  it("returns true on Saturday UTC", () => {
    assert.equal(shouldSkipRealtimeMarketIngest(new Date("2026-05-16T12:00:00.000Z")), true);
  });

  it("returns true on Sunday UTC", () => {
    assert.equal(shouldSkipRealtimeMarketIngest(new Date("2026-05-17T12:00:00.000Z")), true);
  });

  it("returns false on weekday UTC", () => {
    assert.equal(shouldSkipRealtimeMarketIngest(new Date("2026-05-19T12:00:00.000Z")), false);
  });
});
