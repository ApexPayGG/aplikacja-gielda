import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { disconnectTestPrisma } from "../../testHelpers/httpServer";
import {
  buildStripeTrialSyncFields,
  buildSubscriptionAccessPatch,
} from "./stripeModule";

const STRIPE_TRIAL_END_UNIX = Math.floor(new Date("2026-06-05T12:00:00.000Z").getTime() / 1000);

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    role: "USER",
    tier: "FREE",
    subscriptionStatus: "free",
    trialStartedAt: new Date("2026-05-18T12:00:00.000Z"),
    trialEndsAt: new Date("2026-05-25T12:00:00.000Z"),
    trialKind: "without_card",
    ...overrides,
  };
}

describe("buildStripeTrialSyncFields", () => {
  it("maps Stripe trial_end unix timestamp when status is trialing", () => {
    const sync = buildStripeTrialSyncFields({
      subscriptionStatus: "trialing",
      trialEndUnix: STRIPE_TRIAL_END_UNIX,
      existingTrialStartedAt: new Date("2026-05-22T12:00:00.000Z"),
    });

    assert.ok(sync);
    assert.equal(sync.trialEndsAt.toISOString(), "2026-06-05T12:00:00.000Z");
    assert.equal(sync.trialKind, "with_card");
    assert.equal(sync.trialStartedAt.toISOString(), "2026-05-22T12:00:00.000Z");
  });

  it("returns null when subscription is active", () => {
    const sync = buildStripeTrialSyncFields({
      subscriptionStatus: "active",
      trialEndUnix: STRIPE_TRIAL_END_UNIX,
      existingTrialStartedAt: null,
    });
    assert.equal(sync, null);
  });
});

describe("buildSubscriptionAccessPatch", () => {
  it("checkout.session.completed trialing sets trialEndsAt and SUBSCRIPTION_TRIALING", () => {
    const patch = buildSubscriptionAccessPatch({
      user: baseUser(),
      nextTier: "PRO",
      subscriptionStatus: "trialing",
      subscriptionEnd: new Date("2026-06-05T12:00:00.000Z"),
      stripeTrialEndUnix: STRIPE_TRIAL_END_UNIX,
    });

    assert.equal(patch.accessState, "SUBSCRIPTION_TRIALING");
    assert.equal(patch.trialKind, "with_card");
    assert.equal(patch.trialEndsAt?.toISOString(), "2026-06-05T12:00:00.000Z");
    assert.equal(patch.tier, "PRO");
  });

  it("customer.subscription.updated trialing syncs trialEndsAt from Stripe", () => {
    const patch = buildSubscriptionAccessPatch({
      user: baseUser({
        trialEndsAt: new Date("2026-05-25T12:00:00.000Z"),
        trialKind: "without_card",
      }),
      nextTier: "PRO_PLUS",
      subscriptionStatus: "trialing",
      subscriptionEnd: new Date("2026-06-05T12:00:00.000Z"),
      stripeTrialEndUnix: STRIPE_TRIAL_END_UNIX,
    });

    assert.equal(patch.accessState, "SUBSCRIPTION_TRIALING");
    assert.equal(patch.trialEndsAt?.toISOString(), "2026-06-05T12:00:00.000Z");
    assert.equal(patch.trialKind, "with_card");
  });

  it("active subscription leaves historical trialEndsAt and sets SUBSCRIPTION_ACTIVE", () => {
    const historicalTrialEnd = new Date("2026-05-20T12:00:00.000Z");
    const patch = buildSubscriptionAccessPatch({
      user: baseUser({ trialEndsAt: historicalTrialEnd, trialKind: "with_card" }),
      nextTier: "PRO",
      subscriptionStatus: "active",
      subscriptionEnd: new Date("2026-07-01T12:00:00.000Z"),
      stripeTrialEndUnix: STRIPE_TRIAL_END_UNIX,
    });

    assert.equal(patch.accessState, "SUBSCRIPTION_ACTIVE");
    assert.equal(patch.trialEndsAt, undefined);
    assert.equal(patch.trialKind, "with_card");
  });

  it("canceled subscription falls back to future no-card trial", () => {
    const patch = buildSubscriptionAccessPatch({
      user: baseUser({
        trialEndsAt: new Date("2026-06-01T12:00:00.000Z"),
        trialKind: "without_card",
      }),
      nextTier: "FREE",
      subscriptionStatus: "canceled",
      subscriptionEnd: new Date("2026-05-25T12:00:00.000Z"),
    });

    assert.equal(patch.accessState, "TRIAL_ACTIVE");
    assert.equal(patch.tier, "FREE");
  });

  it("canceled subscription falls back to TRIAL_EXPIRED when trial ended", () => {
    const patch = buildSubscriptionAccessPatch({
      user: baseUser({
        trialEndsAt: new Date("2026-05-01T12:00:00.000Z"),
        trialKind: "without_card",
      }),
      nextTier: "FREE",
      subscriptionStatus: "canceled",
      subscriptionEnd: new Date("2026-05-25T12:00:00.000Z"),
    });

    assert.equal(patch.accessState, "TRIAL_EXPIRED");
  });
});

describe("SUBSCRIPTION_TRIALING daysRemaining uses synced trialEndsAt", () => {
  it("computes days remaining from Stripe trial_end date", () => {
    const patch = buildSubscriptionAccessPatch({
      user: baseUser({ trialStartedAt: null, trialEndsAt: null }),
      nextTier: "PRO",
      subscriptionStatus: "trialing",
      subscriptionEnd: null,
      stripeTrialEndUnix: STRIPE_TRIAL_END_UNIX,
    });

    assert.equal(patch.trialEndsAt?.toISOString(), "2026-06-05T12:00:00.000Z");
    assert.ok(patch.trialStartedAt instanceof Date);
    assert.equal(patch.accessState, "SUBSCRIPTION_TRIALING");
  });
});

after(async () => {
  await disconnectTestPrisma();
});
