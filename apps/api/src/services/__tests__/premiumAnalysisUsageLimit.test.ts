import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PREMIUM_ANALYSIS_PRO_DAILY_LIMIT,
  PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT,
  PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT,
  buildPremiumAnalysisUsageKey,
  enforcePremiumAnalysisDailyLimit,
  isActiveTrialAccess,
  parsePremiumAnalysisDailyLimit,
} from "../premiumAnalysisUsageLimit";

describe("parsePremiumAnalysisDailyLimit", () => {
  it("uses default for missing or invalid values", () => {
    assert.equal(parsePremiumAnalysisDailyLimit(undefined, 3), 3);
    assert.equal(parsePremiumAnalysisDailyLimit(null, 3), 3);
    assert.equal(parsePremiumAnalysisDailyLimit("", 3), 3);
    assert.equal(parsePremiumAnalysisDailyLimit("   ", 10), 10);
    assert.equal(parsePremiumAnalysisDailyLimit("abc", 3), 3);
    assert.equal(parsePremiumAnalysisDailyLimit(Number.NaN, 10), 10);
  });

  it("returns truncated finite numbers including zero and negative", () => {
    assert.equal(parsePremiumAnalysisDailyLimit("5", 3), 5);
    assert.equal(parsePremiumAnalysisDailyLimit("5.9", 3), 5);
    assert.equal(parsePremiumAnalysisDailyLimit(0, 3), 0);
    assert.equal(parsePremiumAnalysisDailyLimit("-2", 3), -2);
  });
});

describe("isActiveTrialAccess", () => {
  it("recognizes active trial access states", () => {
    assert.equal(isActiveTrialAccess("TRIAL_ACTIVE"), true);
    assert.equal(isActiveTrialAccess("SUBSCRIPTION_TRIALING"), true);
    assert.equal(isActiveTrialAccess("TRIAL_EXPIRED"), false);
    assert.equal(isActiveTrialAccess("NO_ACCESS"), false);
  });
});

describe("premiumAnalysisUsageLimit", () => {
  it("FREE without trial is blocked with limit 0 without using a store", async () => {
    const result = await enforcePremiumAnalysisDailyLimit({
      tier: "FREE",
      userId: "user-free",
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.limit, 0);
      assert.equal(result.tier, "FREE");
      assert.equal(result.resetIn, 86_400);
    }
  });

  it("FREE with TRIAL_EXPIRED is blocked with limit 0", async () => {
    const result = await enforcePremiumAnalysisDailyLimit({
      tier: "FREE",
      userId: "user-expired",
      accessState: "TRIAL_EXPIRED",
      canUseProduct: false,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.limit, 0);
  });

  it("FREE + TRIAL_ACTIVE is allowed until trial limit and blocked after", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };
    const input = {
      tier: "FREE" as const,
      userId: "user-trial",
      accessState: "TRIAL_ACTIVE",
      canUseProduct: true,
      store,
    };

    for (let i = 0; i < PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT; i += 1) {
      const ok = await enforcePremiumAnalysisDailyLimit(input);
      assert.equal(ok.allowed, true);
    }

    const blocked = await enforcePremiumAnalysisDailyLimit(input);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.limit, PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT);
      assert.equal(blocked.tier, "FREE");
    }
  });

  it("FREE + SUBSCRIPTION_TRIALING is allowed until trial limit and blocked after", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };
    const input = {
      tier: "FREE" as const,
      userId: "user-stripe-trial",
      accessState: "SUBSCRIPTION_TRIALING",
      canUseProduct: true,
      store,
    };

    for (let i = 0; i < PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT; i += 1) {
      const ok = await enforcePremiumAnalysisDailyLimit(input);
      assert.equal(ok.allowed, true);
    }

    const blocked = await enforcePremiumAnalysisDailyLimit(input);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.limit, PREMIUM_ANALYSIS_TRIAL_DAILY_LIMIT);
    }
  });

  it("PRO is allowed until PREMIUM_ANALYSIS_PRO_DAILY_LIMIT and blocked after", async () => {
    let count = 0;
    let incrementCalls = 0;
    const store = {
      async increment() {
        incrementCalls += 1;
        count += 1;
        return { count, resetIn: 3600 };
      },
    };

    const input = { tier: "PRO" as const, userId: "user-pro", store };

    for (let i = 0; i < PREMIUM_ANALYSIS_PRO_DAILY_LIMIT; i += 1) {
      const ok = await enforcePremiumAnalysisDailyLimit(input);
      assert.equal(ok.allowed, true);
    }

    const blocked = await enforcePremiumAnalysisDailyLimit(input);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.limit, PREMIUM_ANALYSIS_PRO_DAILY_LIMIT);
      assert.equal(blocked.tier, "PRO");
    }
    assert.equal(incrementCalls, PREMIUM_ANALYSIS_PRO_DAILY_LIMIT + 1);
  });

  it("PRO_PLUS is allowed until PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT and blocked after", async () => {
    let count = 0;
    const store = {
      async increment() {
        count += 1;
        return { count, resetIn: 3600 };
      },
    };
    const input = { tier: "PRO_PLUS" as const, userId: "user-pro-plus", store };

    for (let i = 0; i < PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT; i += 1) {
      const ok = await enforcePremiumAnalysisDailyLimit(input);
      assert.equal(ok.allowed, true);
    }

    const blocked = await enforcePremiumAnalysisDailyLimit(input);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.limit, PREMIUM_ANALYSIS_PRO_PLUS_DAILY_LIMIT);
      assert.equal(blocked.tier, "PRO_PLUS");
    }
  });

  it("buildPremiumAnalysisUsageKey sanitizes subject IDs and includes tier/date", () => {
    const day = new Date().toISOString().slice(0, 10);
    const key = buildPremiumAnalysisUsageKey("PRO_PLUS", "user/id with spaces");
    assert.match(key, new RegExp(`^premium_analysis:pro_plus:user_id_with_spaces:${day}$`));

    const anon = buildPremiumAnalysisUsageKey("free", "anonymous");
    assert.equal(anon, `premium_analysis:free:anonymous:${day}`);
  });
});
