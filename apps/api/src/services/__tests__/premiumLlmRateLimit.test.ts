import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  PREMIUM_LLM_PRO_DAILY_LIMIT,
  enforcePremiumLlmDailyLimit,
  isPremiumLlmRateLimitedPath,
} from "../premiumLlmRateLimit";

describe("premiumLlmRateLimit", () => {
  it("matches only story and catch endpoints", () => {
    assert.equal(isPremiumLlmRateLimitedPath("/api/premium/NVDA.US/story"), true);
    assert.equal(isPremiumLlmRateLimitedPath("/api/premium/NVDA.US/catch"), true);
    assert.equal(isPremiumLlmRateLimitedPath("/api/premium/NVDA.US/verdict"), false);
  });

  it("blocks PRO after daily limit", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };

    const prisma = {
      user: { findUnique: async () => ({ tier: "PRO" }) },
    } as unknown as import("@prisma/client").PrismaClient;

    const req = {
      originalUrl: "/api/premium/AAPL.US/story",
      path: "/AAPL.US/story",
      auth: { userId: "u1" },
    } as Request;

    for (let i = 0; i < PREMIUM_LLM_PRO_DAILY_LIMIT; i += 1) {
      const ok = await enforcePremiumLlmDailyLimit(req, prisma, store);
      assert.equal(ok.allowed, true);
    }
    const blocked = await enforcePremiumLlmDailyLimit(req, prisma, store);
    assert.equal(blocked.allowed, false);
  });

});
