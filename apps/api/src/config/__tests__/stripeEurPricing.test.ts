import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  EurCheckoutNotConfiguredError,
  InvestorOsCheckoutNotSupportedError,
  resolveEurStripePrice,
} from "../stripeEurPricing";

const ENV_KEYS = {
  proMonthly: "STRIPE_PRICE_PRO_MONTHLY_EUR",
  proYearly: "STRIPE_PRICE_PRO_YEARLY_EUR",
  proPlusMonthly: "STRIPE_PRICE_PRO_PLUS_MONTHLY_EUR",
  proPlusYearly: "STRIPE_PRICE_PRO_PLUS_YEARLY_EUR",
} as const;

describe("stripeEurPricing resolver", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it("returns 503-class error when EUR price env is missing", () => {
    delete process.env[ENV_KEYS.proMonthly];
    assert.throws(
      () => resolveEurStripePrice({ plan: "pro", billing: "monthly" }),
      (error: unknown) => {
        assert.ok(error instanceof EurCheckoutNotConfiguredError);
        assert.equal(error.envKey, ENV_KEYS.proMonthly);
        return true;
      },
    );
  });

  it("resolves pro monthly to STRIPE_PRICE_PRO_MONTHLY_EUR", () => {
    process.env[ENV_KEYS.proMonthly] = "price_eur_pro_monthly_test";
    const resolved = resolveEurStripePrice({ plan: "pro", billing: "monthly" });
    assert.equal(resolved.priceId, "price_eur_pro_monthly_test");
    assert.equal(resolved.internalTier, "PRO");
    assert.equal(resolved.envKey, ENV_KEYS.proMonthly);
    assert.equal(resolved.trialPeriodDays, 14);
  });

  it("resolves pro yearly to STRIPE_PRICE_PRO_YEARLY_EUR", () => {
    process.env[ENV_KEYS.proYearly] = "price_eur_pro_yearly_test";
    const resolved = resolveEurStripePrice({ plan: "pro", billing: "yearly" });
    assert.equal(resolved.priceId, "price_eur_pro_yearly_test");
    assert.equal(resolved.internalTier, "PRO");
    assert.equal(resolved.envKey, ENV_KEYS.proYearly);
  });

  it("resolves pro_plus monthly and yearly env keys", () => {
    process.env[ENV_KEYS.proPlusMonthly] = "price_eur_proplus_monthly_test";
    process.env[ENV_KEYS.proPlusYearly] = "price_eur_proplus_yearly_test";

    const monthly = resolveEurStripePrice({ plan: "pro_plus", billing: "monthly" });
    assert.equal(monthly.envKey, ENV_KEYS.proPlusMonthly);
    assert.equal(monthly.internalTier, "PRO_PLUS");

    const yearly = resolveEurStripePrice({ plan: "pro_plus", billing: "yearly" });
    assert.equal(yearly.envKey, ENV_KEYS.proPlusYearly);
    assert.equal(yearly.internalTier, "PRO_PLUS");
  });

  it("does not fall back to legacy USD STRIPE_PRO_* env keys", () => {
    delete process.env[ENV_KEYS.proMonthly];
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_legacy_usd_monthly";
    assert.throws(
      () => resolveEurStripePrice({ plan: "pro", billing: "monthly" }),
      EurCheckoutNotConfiguredError,
    );
  });

  it("rejects investor_os checkout until tier is supported end-to-end", () => {
    process.env.STRIPE_PRICE_INVESTOR_OS_MONTHLY_EUR = "price_eur_investor_os_monthly_test";
    assert.throws(
      () => resolveEurStripePrice({ plan: "investor_os", billing: "monthly" }),
      InvestorOsCheckoutNotSupportedError,
    );
  });
});
