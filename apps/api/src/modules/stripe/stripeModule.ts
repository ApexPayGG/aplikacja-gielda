import Stripe from "stripe";
import { prisma } from "../../db/index";

export type StripePlan = "pro" | "pro_plus";
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

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

function getPriceId(plan: StripePlan, billing: StripeBilling): string {
  if (plan === "pro" && billing === "monthly") {
    return process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() || "price_pro_monthly";
  }
  if (plan === "pro" && billing === "yearly") {
    return process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim() || "price_pro_yearly";
  }
  if (plan === "pro_plus" && billing === "monthly") {
    return process.env.STRIPE_PROPLUS_MONTHLY_PRICE_ID?.trim() || "price_proplus_monthly";
  }
  return process.env.STRIPE_PROPLUS_YEARLY_PRICE_ID?.trim() || "price_proplus_yearly";
}

function parsePeriodEnd(periodEnd: number | null | undefined): Date | null {
  if (!periodEnd || !Number.isFinite(periodEnd)) return null;
  return new Date(periodEnd * 1000);
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<string> {
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
    line_items: [{ price: getPriceId(input.plan, input.billing), quantity: 1 }],
    success_url: "https://stock-ai.pro/payment-success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://stock-ai.pro/payment-cancel",
    metadata: {
      userId: user.id,
      tier,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        tier,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout URL was not generated");
  }

  return session.url;
}

function getTierFromPriceId(priceId: string | undefined): UserTier | null {
  if (!priceId) return null;
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
  const { tier, periodEnd } = await resolveSessionTier(session);
  await prisma.user.update({
    where: { id: userId },
    data: {
      tier,
      stripeCustomerId: customerId ?? undefined,
      subscriptionStatus: "active",
      subscriptionEnd: periodEnd,
    },
  });
}

export async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      tier: "FREE",
      subscriptionStatus: "canceled",
      subscriptionEnd: parsePeriodEnd(subscription.current_period_end),
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
