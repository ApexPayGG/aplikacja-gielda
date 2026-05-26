import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import { prisma } from "../db/index";
import {
  getAuthenticatedUserId,
  requireAuth,
} from "../modules/auth/authMiddleware";
import {
  constructWebhookEvent,
  createCheckoutSession,
  getUserSubscription,
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  type StripeBilling,
  type StripePlan,
} from "../modules/stripe/stripeModule";
import {
  EurCheckoutNotConfiguredError,
  InvestorOsCheckoutNotSupportedError,
} from "../config/stripeEurPricing";

type StripeRouteDeps = {
  createCheckoutSessionFn: typeof createCheckoutSession;
  getUserSubscriptionFn: typeof getUserSubscription;
  handleCheckoutSessionCompletedFn: typeof handleCheckoutSessionCompleted;
  handleSubscriptionDeletedFn: typeof handleSubscriptionDeleted;
  handleSubscriptionUpdatedFn: typeof handleSubscriptionUpdated;
  handleInvoicePaymentFailedFn: typeof handleInvoicePaymentFailed;
  constructWebhookEventFn: typeof constructWebhookEvent;
  requireAuthMiddleware: typeof requireAuth;
  getUserRoleFn: (userId: string) => Promise<string | null>;
};

function isStripeConfigurationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "STRIPE_SECRET_KEY is not set" ||
    error.message === "STRIPE_WEBHOOK_SECRET is not set"
  );
}

function isPlan(value: unknown): value is StripePlan {
  return value === "pro" || value === "pro_plus";
}

function isInvestorOsPlan(value: unknown): boolean {
  return value === "investor_os";
}

function isBilling(value: unknown): value is StripeBilling {
  return value === "monthly" || value === "yearly";
}

type RequestWithRawBody = Request & { rawBody?: Buffer };

async function canReadSubscription(
  req: Request,
  requestedUserId: string,
  getUserRoleFn: StripeRouteDeps["getUserRoleFn"],
): Promise<boolean> {
  const authUserId = getAuthenticatedUserId(req);
  if (requestedUserId === authUserId) return true;
  const role = await getUserRoleFn(authUserId);
  return role === "ADMIN";
}

export function createStripeRouter(depsInput?: Partial<StripeRouteDeps>): Router {
  const deps: StripeRouteDeps = {
    createCheckoutSessionFn: depsInput?.createCheckoutSessionFn ?? createCheckoutSession,
    getUserSubscriptionFn: depsInput?.getUserSubscriptionFn ?? getUserSubscription,
    handleCheckoutSessionCompletedFn:
      depsInput?.handleCheckoutSessionCompletedFn ?? handleCheckoutSessionCompleted,
    handleSubscriptionDeletedFn: depsInput?.handleSubscriptionDeletedFn ?? handleSubscriptionDeleted,
    handleSubscriptionUpdatedFn:
      depsInput?.handleSubscriptionUpdatedFn ?? handleSubscriptionUpdated,
    handleInvoicePaymentFailedFn:
      depsInput?.handleInvoicePaymentFailedFn ?? handleInvoicePaymentFailed,
    constructWebhookEventFn: depsInput?.constructWebhookEventFn ?? constructWebhookEvent,
    requireAuthMiddleware: depsInput?.requireAuthMiddleware ?? requireAuth,
    getUserRoleFn:
      depsInput?.getUserRoleFn ??
      (async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        return user?.role ?? null;
      }),
  };

  const router = Router();

  router.post(
    "/api/stripe/create-checkout-session",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authUserId = getAuthenticatedUserId(req);
        const body = req.body as Record<string, unknown>;
        const bodyUserIdRaw = body.userId;
        if (bodyUserIdRaw !== undefined && bodyUserIdRaw !== null && String(bodyUserIdRaw).trim() !== "") {
          const bodyUserId = String(bodyUserIdRaw).trim();
          if (bodyUserId !== authUserId) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }

        const plan = body.plan;
        const billing = body.billing;
        if (isInvestorOsPlan(plan)) {
          return res.status(501).json({ error: "INVESTOR_OS_CHECKOUT_NOT_SUPPORTED" });
        }
        if (!isPlan(plan) || !isBilling(billing)) {
          return res.status(400).json({ error: "Invalid payload" });
        }

        const url = await deps.createCheckoutSessionFn({
          userId: authUserId,
          plan,
          billing,
        });
        res.json({ url });
      } catch (error) {
        if (error instanceof EurCheckoutNotConfiguredError) {
          return res.status(503).json({ error: "EUR_CHECKOUT_NOT_CONFIGURED" });
        }
        if (error instanceof InvestorOsCheckoutNotSupportedError) {
          return res.status(501).json({ error: "INVESTOR_OS_CHECKOUT_NOT_SUPPORTED" });
        }
        if (error instanceof Error && error.message === "User not found") {
          return res.status(404).json({ error: error.message });
        }
        if (isStripeConfigurationError(error)) {
          return res
            .status(503)
            .json({ error: "Stripe is not configured. Set required STRIPE_* environment variables." });
        }
        if (error instanceof Stripe.errors.StripeError) {
          console.error("Stripe checkout session error:", error.message);
          return res.status(502).json({
            error: "Payment provider error. Check Stripe price IDs and API keys.",
          });
        }
        next(error);
      }
    },
  );

  router.post("/api/stripe/webhook", async (req: RequestWithRawBody, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        return res.status(400).json({ error: "Missing Stripe signature" });
      }
      const rawBody = req.rawBody;
      if (!rawBody) {
        return res.status(400).json({ error: "Missing raw webhook body" });
      }
      const event = deps.constructWebhookEventFn(rawBody, signature);
      if (event.type === "checkout.session.completed") {
        await deps.handleCheckoutSessionCompletedFn(event.data.object);
      } else if (event.type === "customer.subscription.deleted") {
        await deps.handleSubscriptionDeletedFn(event.data.object);
      } else if (event.type === "customer.subscription.updated") {
        await deps.handleSubscriptionUpdatedFn(event.data.object);
      } else if (event.type === "invoice.payment_failed") {
        await deps.handleInvoicePaymentFailedFn(event.data.object);
      }
      res.json({ received: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("signature")) {
        return res.status(400).json({ error: "Invalid Stripe signature" });
      }
      next(error);
    }
  });

  router.get(
    "/api/stripe/subscription/:userId",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        if (!(await canReadSubscription(req, userId, deps.getUserRoleFn))) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const payload = await deps.getUserSubscriptionFn(userId);
        res.json(payload);
      } catch (error) {
        if (error instanceof Error && error.message === "User not found") {
          return res.status(404).json({ error: error.message });
        }
        next(error);
      }
    },
  );

  return router;
}
