import Stripe from "stripe";
import { prisma } from "../../db/index";
import {
  listEurPriceIdTierMappings,
  resolveEurStripePrice,
  type EurCheckoutPlan,
} from "../../config/stripeEurPricing";
import { resolveStoredAccessState, type StoredAccessState } from "../../services/userAccessState";

export type StripePlan = EurCheckoutPlan;
export type StripeBilling = "monthly" | "yearly";
export type UserTier = "FREE" | "PRO" | "PRO_PLUS";

type CreateCheckoutSessionInput = {
  userId: string;
  plan: StripePlan;
  billing: StripeBilling;
};

type SubscriptionState = {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
};

const TIER_BY_PLAN: Record<StripePlan, UserTier> = {
  pro: "PRO",
  pro_plus: "PRO_PLUS",
};

const LEGACY_PLACEHOLDER_PRICE_IDS = new Set([
  "price_pro_monthly",
  "price_pro_yearly",
  "price_proplus_monthly",
  "price_proplus_yearly",
]);

/** @deprecated Legacy USD IDs - webhook mapping only. Checkout uses EUR resolver. */
export function isStripePriceIdsConfigured(): boolean {
  const ids = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim(),
    process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim(),
    process.env.STRIPE_PROPLUS_MONTHLY_PRICE_ID?.trim(),
    process.env.STRIPE_PROPLUS_YEARLY_PRICE_ID?.trim(),
  ];
  return ids.every((id) => Boolean(id) && !LEGACY_PLACEHOLDER_PRICE_IDS.has(id!));
}

export { EurCheckoutNotConfiguredError } from "../../config/stripeEurPricing";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

function parsePeriodEnd(periodEnd: number | null | undefined): Date | null {
  if (!periodEnd || !Number.isFinite(periodEnd)) return null;
  return new Date(periodEnd * 1000);
}

export type StripeTrialSyncResult = {
  trialStartedAt: Date;
  trialEndsAt: Date;
  trialKind: "with_card";
};

/** When Stripe subscription is trialing, map trial_end into user trial access fields. */
export function buildStripeTrialSyncFields(input: {
  subscriptionStatus: string;
  trialEndUnix: number | null | undefined;
  existingTrialStartedAt: Date | null;
}): StripeTrialSyncResult | null {
  if (input.subscriptionStatus.trim().toLowerCase() !== "trialing") {
    return null;
  }

  const trialEndsAt = parsePeriodEnd(input.trialEndUnix);
  if (!trialEndsAt) {
    return null;
  }

  return {
    trialStartedAt: input.existingTrialStartedAt ?? new Date(),
    trialEndsAt,
    trialKind: "with_card",
  };
}

type SubscriptionAccessUser = {
  role: string;
  tier: string;
  subscriptionStatus: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialKind: string | null;
};

export function buildSubscriptionAccessPatch(input: {
  user: SubscriptionAccessUser;
  nextTier: UserTier;
  subscriptionStatus: string;
  subscriptionEnd: Date | null;
  stripeTrialEndUnix?: number | null;
}): {
  tier: UserTier;
  subscriptionStatus: string;
  subscriptionEnd: Date | null;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  trialKind?: "with_card";
  accessState: StoredAccessState;
} {
  const status = input.subscriptionStatus.trim().toLowerCase();
  const trialSync = buildStripeTrialSyncFields({
    subscriptionStatus: input.subscriptionStatus,
    trialEndUnix: input.stripeTrialEndUnix,
    existingTrialStartedAt: input.user.trialStartedAt,
  });

  const trialStartedAt = trialSync?.trialStartedAt ?? input.user.trialStartedAt;
  const trialEndsAt = trialSync?.trialEndsAt ?? input.user.trialEndsAt;
  const trialKind =
    trialSync?.trialKind ??
    (status === "trialing" || status === "active" ? "with_card" : input.user.trialKind);

  const accessState = resolveStoredAccessState({
    ...input.user,
    tier: input.nextTier,
    subscriptionStatus: input.subscriptionStatus,
    trialStartedAt,
    trialEndsAt,
    trialKind,
  });

  return {
    tier: input.nextTier,
    subscriptionStatus: input.subscriptionStatus,
    subscriptionEnd: input.subscriptionEnd,
    accessState,
    ...(trialSync
      ? {
          trialStartedAt: trialSync.trialStartedAt,
          trialEndsAt: trialSync.trialEndsAt,
          trialKind: trialSync.trialKind,
        }
      : status === "trialing" || status === "active"
        ? { trialKind: "with_card" as const }
        : {}),
  };
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string> {
  const resolved = resolveEurStripePrice({ plan: input.plan, billing: input.billing });
  const stripe = getStripe();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const tier = TIER_BY_PLAN[input.plan];
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: resolved.priceId, quantity: 1 }],
    success_url: "https://stock-ai.pro/payment-success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://stock-ai.pro/payment-cancel",
    metadata: {
      userId: user.id,
      tier,
      plan: input.plan,
      billing: input.billing,
      currency: "EUR",
    },
    subscription_data: {
      trial_period_days: resolved.trialPeriodDays,
      metadata: {
        userId: user.id,
        tier,
        plan: input.plan,
        billing: input.billing,
        currency: "EUR",
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout URL was not generated");
  }

  return session.url;
}

export async function createCustomerPortalSession(userId: string): Promise<string> {
  const stripe = getStripe();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user) {
    throw new Error("User not found");
  }
  const customerId = user.stripeCustomerId?.trim();
  if (!customerId) {
    throw new Error("STRIPE_CUSTOMER_NOT_FOUND");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: "https://stock-ai.pro/settings",
  });

  if (!session.url) {
    throw new Error("Stripe portal URL was not generated");
  }

  return session.url;
}

function getTierFromPriceId(priceId: string | undefined): UserTier | null {
  if (!priceId) return null;

  for (const mapping of listEurPriceIdTierMappings()) {
    if (priceId === mapping.priceId) {
      return mapping.tier;
    }
  }

  const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() || "price_pro_monthly";
  const proYearly = process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim() || "price_pro_yearly";
  const proPlusMonthly =
    process.env.STRIPE_PROPLUS_MONTHLY_PRICE_ID?.trim() || "price_proplus_monthly";
  const proPlusYearly =
    process.env.STRIPE_PROPLUS_YEARLY_PRICE_ID?.trim() || "price_proplus_yearly";
  if (priceId === proMonthly || priceId === proYearly) return "PRO";
  if (priceId === proPlusMonthly || priceId === proPlusYearly) return "PRO_PLUS";
  return null;
}

export function constructWebhookEvent(rawBody: Buffer, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function resolveSessionTier(
  session: any,
): Promise<{ tier: UserTier; periodEnd: Date | null }> {
  const metadataTier = session.metadata?.tier;
  if (metadataTier === "PRO" || metadataTier === "PRO_PLUS") {
    return { tier: metadataTier, periodEnd: null };
  }
  if (!session.subscription || typeof session.subscription !== "string") {
    return { tier: "PRO", periodEnd: null };
  }
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(session.subscription);
  const item = sub.items.data[0];
  const priceId = item?.price?.id;
  const tier = getTierFromPriceId(priceId) ?? "PRO";
  const currentPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  return { tier, periodEnd: parsePeriodEnd(currentPeriodEnd) };
}

export async function handleCheckoutSessionCompleted(session: any): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  let tier: UserTier =
    session.metadata?.tier === "PRO_PLUS"
      ? "PRO_PLUS"
      : session.metadata?.tier === "PRO"
        ? "PRO"
        : "PRO";
  let periodEnd: Date | null = null;
  let subscriptionStatus = "active";
  let stripeTrialEndUnix: number | null | undefined;

  if (session.subscription && typeof session.subscription === "string") {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    subscriptionStatus = String(sub.status ?? "active");
    stripeTrialEndUnix = sub.trial_end ?? null;
    const item = sub.items.data[0];
    tier = getTierFromPriceId(item?.price?.id) ?? tier;
    periodEnd = parsePeriodEnd((sub as unknown as { current_period_end?: number }).current_period_end);
  } else {
    const resolved = await resolveSessionTier(session);
    tier = resolved.tier;
    periodEnd = resolved.periodEnd;
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      tier: true,
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialKind: true,
    },
  });
  if (!existing) return;

  const patch = buildSubscriptionAccessPatch({
    user: existing,
    nextTier: tier,
    subscriptionStatus,
    subscriptionEnd: periodEnd,
    stripeTrialEndUnix,
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...patch,
      stripeCustomerId: customerId ?? undefined,
    },
  });
}

export async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const users = await prisma.user.findMany({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      role: true,
      tier: true,
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialKind: true,
    },
  });

  const subscriptionEnd = parsePeriodEnd(subscription.current_period_end);

  for (const user of users) {
    const accessState = resolveStoredAccessState({
      ...user,
      tier: "FREE",
      subscriptionStatus: "canceled",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: "FREE",
        subscriptionStatus: "canceled",
        subscriptionEnd,
        accessState,
      },
    });
  }
}

function resolveSubscriptionTier(subscription: {
  metadata?: { tier?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
}): UserTier | null {
  const metadataTier = subscription.metadata?.tier;
  if (metadataTier === "PRO" || metadataTier === "PRO_PLUS") {
    return metadataTier;
  }
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return getTierFromPriceId(priceId);
}

export async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const status = String(subscription.status ?? "").trim();
  const tier = resolveSubscriptionTier(subscription);
  const subscriptionEnd = parsePeriodEnd(subscription.current_period_end);

  const users = await prisma.user.findMany({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      role: true,
      tier: true,
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialKind: true,
    },
  });

  for (const user of users) {
    const paidActive = status === "active" || status === "trialing";
    const nextTier: UserTier =
      paidActive && tier ? tier : status === "canceled" || status === "unpaid" ? "FREE" : (user.tier as UserTier);
    const normalizedStatus = status || "unknown";
    const patch = buildSubscriptionAccessPatch({
      user,
      nextTier,
      subscriptionStatus: normalizedStatus,
      subscriptionEnd,
      stripeTrialEndUnix: subscription.trial_end ?? null,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: patch,
    });
  }
}

export async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: "past_due",
    },
  });
}

export async function getUserSubscription(userId: string): Promise<SubscriptionState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, subscriptionStatus: true, subscriptionEnd: true },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return {
    tier: user.tier,
    status: user.subscriptionStatus ?? "free",
    currentPeriodEnd: user.subscriptionEnd ? user.subscriptionEnd.toISOString() : null,
  };
}
