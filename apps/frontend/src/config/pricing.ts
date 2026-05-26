/**
 * StockAI Pro - EUR trial-first pricing & access matrix (PRICING.1).
 * Single source of truth for product positioning. Keep in sync with:
 *   apps/api/src/config/pricing.ts
 *
 * Not wired to live Stripe checkout yet - use env placeholders for future Price IDs.
 */

export const PRICING_CURRENCY = "EUR" as const;
export type PricingCurrency = typeof PRICING_CURRENCY;

export type PlanId = "PRO" | "PRO_PLUS" | "INVESTOR_OS";
export type BillingCycle = "monthly" | "yearly";

/** Legacy DB/API tier values - INVESTOR_OS is forward-looking (not in Stripe checkout yet). */
export type SubscriptionTier = "FREE" | "PRO" | "PRO_PLUS" | "INVESTOR_OS";

export type TrialKind = "without_card" | "with_card";

export type AccountAccessState =
  | "trial_active"
  | "trial_expired"
  | "subscribed"
  | "none";

export type PricingPlan = {
  id: PlanId;
  /** Stripe checkout slug when supported (investor_os not yet). */
  checkoutSlug?: "pro" | "pro_plus";
  displayName: string;
  tagline: string;
  pricesEur: Record<BillingCycle, number>;
  stripePriceEnvKeys: Record<BillingCycle, string>;
  featureGroups: string[];
};

export const PRICING_PLANS: Record<PlanId, PricingPlan> = {
  PRO: {
    id: "PRO",
    checkoutSlug: "pro",
    displayName: "Pro",
    tagline: "Know what is happening.",
    pricesEur: { monthly: 29, yearly: 290 },
    stripePriceEnvKeys: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY_EUR",
      yearly: "STRIPE_PRICE_PRO_YEARLY_EUR",
    },
    featureGroups: [
      "AI Brief",
      "Company Detail",
      "Signals",
      "Basic Event Radar",
      "Basic Premium Analysis",
      "Watchlist",
      "Basic alerts",
    ],
  },
  PRO_PLUS: {
    id: "PRO_PLUS",
    checkoutSlug: "pro_plus",
    displayName: "Pro+",
    tagline: "Know what it means.",
    pricesEur: { monthly: 59, yearly: 590 },
    stripePriceEnvKeys: {
      monthly: "STRIPE_PRICE_PRO_PLUS_MONTHLY_EUR",
      yearly: "STRIPE_PRICE_PRO_PLUS_YEARLY_EUR",
    },
    featureGroups: [
      "Full Premium Analysis",
      "Historical Twins",
      "Dirty Truth",
      "Pre-Mortem",
      "Behavioral Coach",
      "Decision Journal",
      "Full Event Intelligence",
      "Higher AI limits",
    ],
  },
  INVESTOR_OS: {
    id: "INVESTOR_OS",
    displayName: "Investor OS",
    tagline: "Know what it means for you.",
    pricesEur: { monthly: 99, yearly: 990 },
    stripePriceEnvKeys: {
      monthly: "STRIPE_PRICE_INVESTOR_OS_MONTHLY_EUR",
      yearly: "STRIPE_PRICE_INVESTOR_OS_YEARLY_EUR",
    },
    featureGroups: [
      "Personal Fit Score",
      "Portfolio-aware analysis",
      "Trader Psyche",
      "Behavioral alerts",
      "Weekly AI investor review",
      "Broker sync readiness",
      "Autopilot readiness",
      "Advanced event intelligence",
      "Priority AI",
      "Highest limits",
    ],
  },
};

export type TrialRule = {
  days: number;
  experienceTier: PlanId;
  description: string;
  limits: {
    aiUsage: "limited" | "fair_use";
    autopilotLive: boolean;
    brokerSync: boolean;
    heavyExports: boolean;
  };
  /** Card-required trial converts to selected paid plan via Stripe after expiry. */
  convertsToPaidPlan?: boolean;
};

export const TRIAL_RULES: Record<TrialKind, TrialRule> = {
  without_card: {
    days: 7,
    experienceTier: "PRO_PLUS",
    description: "7-day Pro+ experience without payment method.",
    limits: {
      aiUsage: "limited",
      autopilotLive: false,
      brokerSync: false,
      heavyExports: false,
    },
  },
  with_card: {
    days: 14,
    experienceTier: "PRO_PLUS",
    description: "14-day Pro+ trial; converts to selected plan when trial ends.",
    limits: {
      aiUsage: "fair_use",
      autopilotLive: false,
      brokerSync: false,
      heavyExports: false,
    },
    convertsToPaidPlan: true,
  },
};

/** After trial expiry - account remains; almost no product value. */
export const TRIAL_EXPIRED_ACCESS = {
  allowed: [
    "account_settings",
    "pricing_page",
    "billing_page",
    "history_read_only",
    "affiliate_cta_compliant",
    "limited_public_preview",
  ],
  blocked: [
    "new_ai_brief",
    "premium_analysis",
    "signals",
    "personal_fit",
    "dirty_truth",
    "historical_twins",
    "pre_mortem",
    "alerts",
    "exports",
    "autopilot",
    "broker_sync",
  ],
} as const;

/** Placeholder fair-use caps - tune when enforcement middleware is implemented. */
export const FAIR_USE_LIMITS = {
  trialWithoutCard: {
    aiBriefsPerDay: 5,
    premiumAnalysisViewsPerMonth: 10,
    signalsViewsPerDay: 20,
  },
  trialWithCard: {
    aiBriefsPerDay: 25,
    premiumAnalysisViewsPerMonth: 50,
    signalsViewsPerDay: 100,
  },
  pro: {
    aiBriefsPerDay: 40,
    premiumAnalysisViewsPerMonth: null,
    signalsViewsPerDay: null,
  },
  proPlus: {
    aiBriefsPerDay: 80,
    premiumAnalysisViewsPerMonth: null,
    signalsViewsPerDay: null,
  },
  investorOs: {
    aiBriefsPerDay: null,
    premiumAnalysisViewsPerMonth: null,
    signalsViewsPerDay: null,
  },
} as const;

/** Documented future monetization - not implemented in checkout. */
export const FUTURE_MONETIZATION = {
  singlePremiumReport: {
    priceEur: 19,
    status: "planned" as const,
    note: "One-off Premium Report - document only until billing SKU exists.",
  },
  aiCredits: {
    status: "planned" as const,
    note: "Add-on AI credits pack - document only until metering exists.",
  },
  foundingOffers: {
    status: "documented_only" as const,
    note: "Founding-member discounts may be documented in marketing; do not hardcode in checkout.",
  },
} as const;

export const PRICING_MODEL_NOTES = {
  noClassicFreePlan: true,
  defaultEntry: "trial" as const,
  currency: PRICING_CURRENCY,
} as const;

export function formatEurPrice(planId: PlanId, billing: BillingCycle): string {
  const amount = PRICING_PLANS[planId].pricesEur[billing];
  const suffix = billing === "monthly" ? "/mo" : "/yr";
  return `€${amount}${suffix}`;
}

export function annualSavingsPercent(planId: PlanId): number {
  const { monthly, yearly } = PRICING_PLANS[planId].pricesEur;
  const fullYearMonthly = monthly * 12;
  if (fullYearMonthly <= 0) return 0;
  return Math.round((1 - yearly / fullYearMonthly) * 100);
}

export function isCheckoutPlanAvailable(planId: PlanId): boolean {
  return Boolean(PRICING_PLANS[planId].checkoutSlug);
}
