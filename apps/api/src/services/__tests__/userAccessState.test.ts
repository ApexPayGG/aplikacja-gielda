import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRegistrationTrialWindow,
  getUserAccessState,
  resolveStoredAccessState,
} from "../userAccessState";

const NOW = new Date("2026-05-22T12:00:00.000Z");

function baseUser(overrides: Partial<Parameters<typeof getUserAccessState>[0]> = {}) {
  return {
    role: "USER",
    tier: "FREE",
    subscriptionStatus: "free",
    trialStartedAt: new Date("2026-05-15T12:00:00.000Z"),
    trialEndsAt: new Date("2026-05-29T12:00:00.000Z"),
    trialKind: "without_card",
    ...overrides,
  };
}

describe("userAccessState", () => {
  it("buildRegistrationTrialWindow creates 7-day no-card trial", () => {
    const trial = buildRegistrationTrialWindow(NOW);
    assert.equal(trial.trialKind, "without_card");
    assert.equal(trial.accessState, "TRIAL_ACTIVE");
    assert.equal(trial.trialStartedAt.toISOString(), NOW.toISOString());
    assert.equal(trial.trialEndsAt.toISOString(), "2026-05-29T12:00:00.000Z");
  });

  it("returns TRIAL_ACTIVE when trialEndsAt is in the future", () => {
    const access = getUserAccessState(baseUser(), NOW);
    assert.equal(access.accessState, "TRIAL_ACTIVE");
    assert.equal(access.canUseProduct, true);
    assert.equal(access.upgradeRequired, false);
    assert.ok((access.daysRemaining ?? 0) > 0);
  });

  it("returns TRIAL_EXPIRED when trialEndsAt is in the past", () => {
    const access = getUserAccessState(
      baseUser({ trialEndsAt: new Date("2026-05-20T12:00:00.000Z") }),
      NOW,
    );
    assert.equal(access.accessState, "TRIAL_EXPIRED");
    assert.equal(access.canUseProduct, false);
    assert.equal(access.upgradeRequired, true);
    assert.equal(access.daysRemaining, 0);
  });

  it("active subscription overrides expired no-card trial", () => {
    const access = getUserAccessState(
      baseUser({
        tier: "PRO",
        subscriptionStatus: "active",
        trialEndsAt: new Date("2026-05-01T12:00:00.000Z"),
      }),
      NOW,
    );
    assert.equal(access.accessState, "SUBSCRIPTION_ACTIVE");
    assert.equal(access.canUseProduct, true);
    assert.equal(access.upgradeRequired, false);
  });

  it("trialing subscription grants product access", () => {
    const access = getUserAccessState(
      baseUser({
        tier: "PRO_PLUS",
        subscriptionStatus: "trialing",
      }),
      NOW,
    );
    assert.equal(access.accessState, "SUBSCRIPTION_TRIALING");
    assert.equal(access.canUseProduct, true);
  });

  it("canceled subscription falls back to active no-card trial", () => {
    const access = getUserAccessState(
      baseUser({
        tier: "FREE",
        subscriptionStatus: "canceled",
        trialEndsAt: new Date("2026-05-29T12:00:00.000Z"),
      }),
      NOW,
    );
    assert.equal(access.accessState, "TRIAL_ACTIVE");
    assert.equal(access.canUseProduct, true);
  });

  it("canceled subscription falls back to TRIAL_EXPIRED when trial ended", () => {
    const access = getUserAccessState(
      baseUser({
        tier: "FREE",
        subscriptionStatus: "canceled",
        trialEndsAt: new Date("2026-05-01T12:00:00.000Z"),
      }),
      NOW,
    );
    assert.equal(access.accessState, "TRIAL_EXPIRED");
    assert.equal(resolveStoredAccessState(baseUser({
      tier: "FREE",
      subscriptionStatus: "canceled",
      trialEndsAt: new Date("2026-05-01T12:00:00.000Z"),
    }), NOW), "TRIAL_EXPIRED");
  });

  it("admin bypasses access checks", () => {
    const access = getUserAccessState(
      baseUser({
        role: "ADMIN",
        trialEndsAt: new Date("2020-01-01T12:00:00.000Z"),
        subscriptionStatus: "canceled",
      }),
      NOW,
    );
    assert.equal(access.canUseProduct, true);
    assert.equal(access.upgradeRequired, false);
  });
});
