import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import {
  constructWebhookEvent,
  createCheckoutSession,
  getUserSubscription,
  handleCheckoutSessionCompleted,
  handleSubscriptionDeleted,
  type StripeBilling,
  type StripePlan,
} from "../modules/stripe/stripeModule";

type StripeRouteDeps = {
  createCheckoutSessionFn: typeof createCheckoutSession;
  getUserSubscriptionFn: typeof getUserSubscription;
  handleCheckoutSessionCompletedFn: typeof handleCheckoutSessionCompleted;
  handleSubscriptionDeletedFn: typeof handleSubscriptionDeleted;
  constructWebhookEventFn: typeof constructWebhookEvent;
};

function isStripeConfigurationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "STRIPE_SECRET_KEY is not set" ||
    error.message === "STRIPE_WEBHOOK_SECRET is not set" ||
    error.message === "STRIPE_PRICE_IDS are not configured"
  );
}

function isPlan(value: unknown): value is StripePlan {
  return value === "pro" || value === "pro_plus";
}

function isBilling(value: unknown): value is StripeBilling {
  return value === "monthly" || value === "yearly";
}

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function createStripeRouter(depsInput?: Partial<StripeRouteDeps>): Router {
  const deps: StripeRouteDeps = {
    createCheckoutSessionFn: depsInput?.createCheckoutSessionFn ?? createCheckoutSession,
    getUserSubscriptionFn: depsInput?.getUserSubscriptionFn ?? getUserSubscription,
    handleCheckoutSessionCompletedFn:
      depsInput?.handleCheckoutSessionCompletedFn ?? handleCheckoutSessionCompleted,
    handleSubscriptionDeletedFn: depsInput?.handleSubscriptionDeletedFn ?? handleSubscriptionDeleted,
    constructWebhookEventFn: depsInput?.constructWebhookEventFn ?? constructWebhookEvent,
  };

  const router = Router();

  router.post(
    "/api/stripe/create-checkout-session",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as Record<string, unknown>;
        const userId = String(body.userId ?? "").trim();
        const plan = body.plan;
        const billing = body.billing;
        if (!userId || !isPlan(plan) || !isBilling(billing)) {
          return res.status(400).json({ error: "Invalid payload" });
        }
        const url = await deps.createCheckoutSessionFn({ userId, plan, billing });
        res.json({ url });
      } catch (error) {
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
      }
      res.json({ received: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("signature")) {
        return res.status(400).json({ error: "Invalid Stripe signature" });
      }
      next(error);
    }
  });

  router.get("/api/stripe/subscription/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }
      const payload = await deps.getUserSubscriptionFn(userId);
      res.json(payload);
    } catch (error) {
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  });

  return router;
}
