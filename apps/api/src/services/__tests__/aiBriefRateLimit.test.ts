import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  enforceAiBriefFreeRateLimit,
  isAiBriefRateLimitedPath,
} from "../aiBriefRateLimit";

describe("aiBriefRateLimit path scope", () => {
  it("matches only AI Brief endpoints", () => {
    assert.equal(isAiBriefRateLimitedPath("/api/analysis/AAPL.US"), true);
    assert.equal(isAiBriefRateLimitedPath("/api/brief/MSFT.US"), true);
    assert.equal(isAiBriefRateLimitedPath("/api/companies/ABBV.US/brief"), true);
  });

  it("does not match Premium Analysis or other routes", () => {
    assert.equal(isAiBriefRateLimitedPath("/api/premium/ABBV.US/catch"), false);
    assert.equal(isAiBriefRateLimitedPath("/api/premium/ABBV.US/verdict"), false);
    assert.equal(isAiBriefRateLimitedPath("/api/companies/ABBV.US"), false);
    assert.equal(isAiBriefRateLimitedPath("/api/copilot/chat"), false);
  });

  it("skips counter for non-brief paths", async () => {
    const increments: string[] = [];
    const store = {
      async increment(key: string, windowSec: number) {
        increments.push(key);
        assert.equal(windowSec, 86_400);
        return { count: 99, resetIn: 60 };
      },
    };

    const req = { originalUrl: "/api/premium/ABBV.US/catch", path: "/ABBV.US/catch" } as Request;
    const result = await enforceAiBriefFreeRateLimit(req, undefined, store);
    assert.equal(result.allowed, true);
    assert.equal(increments.length, 0);
  });
});
