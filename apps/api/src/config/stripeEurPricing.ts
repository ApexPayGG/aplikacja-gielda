/**
 * EUR Stripe Price ID resolver (PRICING.3).
 * Checkout uses STRIPE_PRICE_*_EUR env keys only - never legacy USD STRIPE_PRO_* IDs.
 */

import { PRICING_PLANS, TRIAL_RULES, type BillingCycle, type PlanId } from "./pricing";

export type EurCheckoutPlan = "pro" | "pro_plus";
export type EurCheckoutPlanInput = EurCheckoutPlan | "investor_os";

export class EurCheckoutNotConfiguredError extends Error {
  readonly code = "EUR_CHECKOUT_NOT_CONFIGURED" as const;

  constructor(public readonly envKey: string) {
    super("EUR_CHECKOUT_NOT_CONFIGURED");
    this.name = "EurCheckoutNotConfiguredError";
  }
}

export class InvestorOsCheckoutNotSupportedError extends Error {
  readonly code = "INVESTOR_OS_CHECKOUT_NOT_SUPPORTED" as const;

  constructor() {
    super("INVESTOR_OS_CHECKOUT_NOT_SUPPORTED");
    this.name = "InvestorOsCheckoutNotSupportedError";
  }
}

function isPlaceholderPriceId(id: string): boolean {
  const trimmed = id.trim();
  return !trimmed || trimmed === "price_REPLACE" || trimmed.endsWith("_REPLACE");
}

function planSlugToPlanId(plan: EurCheckoutPlan): PlanId {
  return plan === "pro" ? "PRO" : "PRO_PLUS";
}

export type ResolvedEurStripePrice = {
  priceId: string;
  internalTier: "PRO" | "PRO_PLUS";
  envKey: string;
  trialPeriodDays: number;
};

export function resolveEurStripePrice(input: {
  plan: EurCheckoutPlanInput;
  billing: BillingCycle;
}): ResolvedEurStripePrice {
  if (input.plan === "investor_os") {
    throw new InvestorOsCheckoutNotSupportedError();
  }

  const planId = planSlugToPlanId(input.plan);
  const envKey = PRICING_PLANS[planId].stripePriceEnvKeys[input.billing];
  const priceId = process.env[envKey]?.trim() ?? "";

  if (isPlaceholderPriceId(priceId)) {
    throw new EurCheckoutNotConfiguredError(envKey);
  }

  return {
    priceId,
    internalTier: planId as "PRO" | "PRO_PLUS",
    envKey,
    trialPeriodDays: TRIAL_RULES.with_card.days,
  };
}

/** Configured EUR Price IDs for webhook tier mapping (Pro / Pro+ only until INVESTOR_OS tier exists in DB). */
export function listEurPriceIdTierMappings(): Array<{ priceId: string; tier: "PRO" | "PRO_PLUS" }> {
  const mappings: Array<{ priceId: string; tier: "PRO" | "PRO_PLUS" }> = [];

  for (const planId of ["PRO", "PRO_PLUS"] as const) {
    for (const billing of ["monthly", "yearly"] as const) {
      const envKey = PRICING_PLANS[planId].stripePriceEnvKeys[billing];
      const priceId = process.env[envKey]?.trim() ?? "";
      if (!isPlaceholderPriceId(priceId)) {
        mappings.push({ priceId, tier: planId });
      }
    }
  }

  return mappings;
}

export function isEurStripeCheckoutConfigured(): boolean {
  try {
    resolveEurStripePrice({ plan: "pro", billing: "monthly" });
    resolveEurStripePrice({ plan: "pro", billing: "yearly" });
    resolveEurStripePrice({ plan: "pro_plus", billing: "monthly" });
    resolveEurStripePrice({ plan: "pro_plus", billing: "yearly" });
    return true;
  } catch (error) {
    if (error instanceof EurCheckoutNotConfiguredError) {
      return false;
    }
    throw error;
  }
}
