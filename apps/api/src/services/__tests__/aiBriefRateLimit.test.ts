import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  AI_BRIEF_PRO_DAILY_LIMIT,
  enforceAiBriefRateLimit,
  isAiBriefRateLimitedPath,
  peekAiBriefCached,
} from "../aiBriefRateLimit";

function mockRequest(partial: object): Request {
  return partial as unknown as Request;
}

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

    const req = mockRequest({ originalUrl: "/api/premium/ABBV.US/catch", path: "/ABBV.US/catch" });
    const result = await enforceAiBriefRateLimit(req, undefined, store);
    assert.equal(result.allowed, true);
    assert.equal(increments.length, 0);
  });

  it("blocks FREE tier after daily limit", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };

    const req = mockRequest({ originalUrl: "/api/brief/AAPL.US", path: "/AAPL.US" });
    for (let i = 0; i < 3; i += 1) {
      const ok = await enforceAiBriefRateLimit(req, undefined, store);
      assert.equal(ok.allowed, true);
    }
    const blocked = await enforceAiBriefRateLimit(req, undefined, store);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.tier, "FREE");
      assert.equal(blocked.limit, 3);
    }
  });

  it("blocks PRO tier after configured daily limit", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };

    const prisma = {
      user: {
        findUnique: async () => ({ tier: "PRO" }),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const req = mockRequest({
      originalUrl: "/api/analysis/CPS.WAR?lang=pl",
      path: "/CPS.WAR",
      query: { lang: "pl" },
      auth: { userId: "user-pro-1" },
    });

    for (let i = 0; i < AI_BRIEF_PRO_DAILY_LIMIT; i += 1) {
      const ok = await enforceAiBriefRateLimit(req, prisma, store);
      assert.equal(ok.allowed, true);
    }
    const blocked = await enforceAiBriefRateLimit(req, prisma, store);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.tier, "PRO");
      assert.equal(blocked.limit, AI_BRIEF_PRO_DAILY_LIMIT);
    }
  });
});

describe("peekAiBriefCached", () => {
  it("returns false when symbol cannot be parsed", async () => {
    const req = mockRequest({ originalUrl: "/api/brief/", path: "/" });
    assert.equal(await peekAiBriefCached(req), false);
  });
});
