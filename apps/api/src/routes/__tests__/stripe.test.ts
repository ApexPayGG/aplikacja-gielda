import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { signAuthToken } from "../../modules/auth/authJwt";
import type { AuthenticatedRequest } from "../../modules/auth/authMiddleware";
import { createStripeRouter } from "../stripe";

describe("stripe routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let authToken = "";
  let completedCalls = 0;
  let deletedCalls = 0;
  let updatedCalls = 0;
  let paymentFailedCalls = 0;
  let lastCheckoutUserId: string | null = null;
  const oldJwtSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: "u-1", email: "user@example.com" });
    completedCalls = 0;
    deletedCalls = 0;
    updatedCalls = 0;
    paymentFailedCalls = 0;
    lastCheckoutUserId = null;

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.path === "/api/stripe/webhook") {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from("{}");
      }
      next();
    });
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "u-1",
            email: "user@example.com",
          };
          next();
        },
        getUserRoleFn: async (userId) => (userId === "admin-1" ? "ADMIN" : "USER"),
        createCheckoutSessionFn: async ({ userId, plan, billing }) => {
          lastCheckoutUserId = userId;
          if (userId === "cfg") {
            throw new Error("STRIPE_SECRET_KEY is not set");
          }
          if (userId === "prices") {
            throw new Error("STRIPE_PRICE_IDS are not configured");
          }
          if (userId === "boom") {
            throw new Error("Database unavailable");
          }
          return `https://checkout.stripe.test/${userId}/${plan}/${billing}`;
        },
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "active",
          currentPeriodEnd: "2026-12-01T00:00:00.000Z",
        }),
        constructWebhookEventFn: () =>
          ({
            type: "checkout.session.completed",
            data: { object: { metadata: { userId: "u-1" } } },
          }) as never,
        handleCheckoutSessionCompletedFn: async () => {
          completedCalls += 1;
        },
        handleSubscriptionDeletedFn: async () => {
          deletedCalls += 1;
        },
        handleSubscriptionUpdatedFn: async () => {
          updatedCalls += 1;
        },
        handleInvoicePaymentFailedFn: async () => {
          paymentFailedCalls += 1;
        },
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (oldJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = oldJwtSecret;
    }
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("POST /api/stripe/create-checkout-session returns URL for authenticated user", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { url: string };
    assert.equal(body.url, "https://checkout.stripe.test/u-1/pro/monthly");
    assert.equal(lastCheckoutUserId, "u-1");
  });

  it("POST /api/stripe/create-checkout-session rejects unauthenticated request", async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, res) => {
          res.status(401).json({ error: "Unauthorized" });
        },
        createCheckoutSessionFn: async () => "https://checkout.stripe.test/should-not-run",
        getUserSubscriptionFn: async () => ({
          tier: "FREE",
          status: "free",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () => ({ type: "noop", data: { object: {} } }) as never,
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {},
        handleInvoicePaymentFailedFn: async () => {},
        getUserRoleFn: async () => "USER",
      }),
    );

    await new Promise<void>((resolve) => {
      server = unauthApp.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const unauthBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${unauthBaseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 401);
  });

  it("POST /api/stripe/create-checkout-session rejects mismatched body.userId", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ userId: "other-user", plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 403);
    assert.equal(lastCheckoutUserId, null);
  });

  it("POST /api/stripe/webhook handles checkout completion", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "test-sig" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.equal(completedCalls, 1);
    assert.equal(deletedCalls, 0);
  });

  it("POST /api/stripe/webhook handles customer.subscription.updated", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from("{}");
      next();
    });
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, _res, next) => next(),
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "active",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () =>
          ({
            type: "customer.subscription.updated",
            data: { object: { customer: "cus_1", status: "active" } },
          }) as never,
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {
          updatedCalls += 1;
        },
        handleInvoicePaymentFailedFn: async () => {},
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const webhookBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${webhookBaseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "test-sig" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.equal(updatedCalls, 1);
  });

  it("POST /api/stripe/webhook handles invoice.payment_failed", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from("{}");
      next();
    });
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, _res, next) => next(),
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "active",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () =>
          ({
            type: "invoice.payment_failed",
            data: { object: { customer: "cus_1" } },
          }) as never,
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {},
        handleInvoicePaymentFailedFn: async () => {
          paymentFailedCalls += 1;
        },
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const webhookBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${webhookBaseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "test-sig" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.equal(paymentFailedCalls, 1);
  });

  it("POST /api/stripe/webhook returns 400 for invalid signature at API layer", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from("{}");
      next();
    });
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, _res, next) => next(),
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "active",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () => {
          throw new Error("Invalid Stripe signature");
        },
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {},
        handleInvoicePaymentFailedFn: async () => {},
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const webhookBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${webhookBaseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "bad-sig" },
      body: "{}",
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid Stripe signature");
  });

  it("GET /api/stripe/subscription/:userId returns subscription for own user", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/subscription/u-1`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      tier: string;
      status: string;
      currentPeriodEnd: string | null;
    };
    assert.equal(body.tier, "PRO");
    assert.equal(body.status, "active");
  });

  it("GET /api/stripe/subscription/:userId rejects unauthenticated request", async () => {
    const unauthApp = express();
    unauthApp.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, res) => {
          res.status(401).json({ error: "Unauthorized" });
        },
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "active",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () => ({ type: "noop", data: { object: {} } }) as never,
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {},
        handleInvoicePaymentFailedFn: async () => {},
      }),
    );

    await new Promise<void>((resolve) => {
      server = unauthApp.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const unauthBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${unauthBaseUrl}/api/stripe/subscription/u-1`);
    assert.equal(res.status, 401);
  });

  it("GET /api/stripe/subscription/:userId rejects different user", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/subscription/other-user`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 403);
  });
});
