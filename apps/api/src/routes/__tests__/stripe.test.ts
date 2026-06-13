import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { signAuthToken } from "../../modules/auth/authJwt";
import type { AuthenticatedRequest } from "../../modules/auth/authMiddleware";
import { EurCheckoutNotConfiguredError } from "../../config/stripeEurPricing";
import { closeTestServer, disconnectTestPrisma, startTestServer } from "../../testHelpers/httpServer";
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
  let lastPortalUserId: string | null = null;
  const oldJwtSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: "u-1", email: "user@example.com" });
    completedCalls = 0;
    deletedCalls = 0;
    updatedCalls = 0;
    paymentFailedCalls = 0;
    lastCheckoutUserId = null;
    lastPortalUserId = null;

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
            throw new EurCheckoutNotConfiguredError("STRIPE_PRICE_PRO_MONTHLY_EUR");
          }
          if (userId === "boom") {
            throw new Error("Database unavailable");
          }
          return `https://checkout.stripe.test/${userId}/${plan}/${billing}`;
        },
        createCustomerPortalSessionFn: async (userId) => {
          lastPortalUserId = userId;
          if (userId === "cfg") {
            throw new Error("STRIPE_SECRET_KEY is not set");
          }
          if (userId === "no-cust") {
            throw new Error("STRIPE_CUSTOMER_NOT_FOUND");
          }
          if (userId === "missing") {
            throw new Error("User not found");
          }
          return `https://billing.stripe.test/portal/${userId}`;
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

    const started = await startTestServer(app);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterEach(async () => {
    if (oldJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = oldJwtSecret;
    }
    await closeTestServer(server);
    server = null;
    baseUrl = "";
  });

  after(async () => {
    await disconnectTestPrisma();
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

  it("POST /api/stripe/create-portal-session returns URL for authenticated user", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: "{}",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { url: string };
    assert.equal(body.url, "https://billing.stripe.test/portal/u-1");
    assert.equal(lastPortalUserId, "u-1");
  });

  it("POST /api/stripe/create-portal-session rejects unauthenticated request", async () => {
    await closeTestServer(server);
    server = null;

    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use(
      createStripeRouter({
        requireAuthMiddleware: (_req, res) => {
          res.status(401).json({ error: "Unauthorized" });
        },
        createCheckoutSessionFn: async () => "https://checkout.stripe.test/should-not-run",
        createCustomerPortalSessionFn: async () => "https://billing.stripe.test/portal/should-not-run",
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

    const started = await startTestServer(unauthApp);
    server = started.server;
    const unauthBaseUrl = started.baseUrl;

    const res = await fetch(`${unauthBaseUrl}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
  });

  it("POST /api/stripe/create-portal-session returns STRIPE_CUSTOMER_NOT_FOUND", async () => {
    await closeTestServer(server);
    server = null;

    const app = express();
    app.use(express.json());
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "no-cust",
            email: "user@example.com",
          };
          next();
        },
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        createCustomerPortalSessionFn: async (userId) => {
          if (userId === "no-cust") {
            throw new Error("STRIPE_CUSTOMER_NOT_FOUND");
          }
          return "https://billing.stripe.test/portal";
        },
        getUserSubscriptionFn: async () => ({
          tier: "PRO",
          status: "trialing",
          currentPeriodEnd: null,
        }),
        constructWebhookEventFn: () => ({ type: "noop", data: { object: {} } }) as never,
        handleCheckoutSessionCompletedFn: async () => {},
        handleSubscriptionDeletedFn: async () => {},
        handleSubscriptionUpdatedFn: async () => {},
        handleInvoicePaymentFailedFn: async () => {},
      }),
    );

    const started = await startTestServer(app);
    server = started.server;
    const portalBaseUrl = started.baseUrl;

    const res = await fetch(`${portalBaseUrl}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: "{}",
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "STRIPE_CUSTOMER_NOT_FOUND");
  });

  it("POST /api/stripe/create-portal-session returns 404 when user not found", async () => {
    await closeTestServer(server);
    server = null;

    const app = express();
    app.use(express.json());
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "missing",
            email: "user@example.com",
          };
          next();
        },
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        createCustomerPortalSessionFn: async () => {
          throw new Error("User not found");
        },
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
      }),
    );

    const started = await startTestServer(app);
    server = started.server;
    const portalBaseUrl = started.baseUrl;

    const res = await fetch(`${portalBaseUrl}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: "{}",
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "User not found");
  });

  it("POST /api/stripe/create-portal-session returns 503 when Stripe is not configured", async () => {
    await closeTestServer(server);
    server = null;

    const app = express();
    app.use(express.json());
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "cfg",
            email: "user@example.com",
          };
          next();
        },
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => "https://checkout.stripe.test",
        createCustomerPortalSessionFn: async () => {
          throw new Error("STRIPE_SECRET_KEY is not set");
        },
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

    const started = await startTestServer(app);
    server = started.server;
    const portalBaseUrl = started.baseUrl;

    const res = await fetch(`${portalBaseUrl}/api/stripe/create-portal-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: "{}",
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Stripe is not configured. Set required STRIPE_* environment variables.");
  });

  it("POST /api/stripe/create-checkout-session returns EUR_CHECKOUT_NOT_CONFIGURED", async () => {
    await closeTestServer(server);
    server = null;

    const app = express();
    app.use(express.json());
    app.use(
      createStripeRouter({
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "u-eur",
            email: "user@example.com",
          };
          next();
        },
        getUserRoleFn: async () => "USER",
        createCheckoutSessionFn: async () => {
          throw new EurCheckoutNotConfiguredError("STRIPE_PRICE_PRO_MONTHLY_EUR");
        },
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
      }),
    );

    const started = await startTestServer(app);
    server = started.server;
    const eurBaseUrl = started.baseUrl;

    const res = await fetch(`${eurBaseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "EUR_CHECKOUT_NOT_CONFIGURED");
  });

  it("POST /api/stripe/create-checkout-session rejects investor_os with 501", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ plan: "investor_os", billing: "monthly" }),
    });
    assert.equal(res.status, 501);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "INVESTOR_OS_CHECKOUT_NOT_SUPPORTED");
  });

  it("POST /api/stripe/create-checkout-session rejects unauthenticated request", async () => {
    await closeTestServer(server);
    server = null;

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

    const started = await startTestServer(unauthApp);
    server = started.server;
    const unauthBaseUrl = started.baseUrl;

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
    await closeTestServer(server);
    server = null;

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

    const started = await startTestServer(app);
    server = started.server;
    const webhookBaseUrl = started.baseUrl;

    const res = await fetch(`${webhookBaseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "test-sig" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.equal(updatedCalls, 1);
  });

  it("POST /api/stripe/webhook handles invoice.payment_failed", async () => {
    await closeTestServer(server);
    server = null;

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

    const started = await startTestServer(app);
    server = started.server;
    const webhookBaseUrl = started.baseUrl;

    const res = await fetch(`${webhookBaseUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "test-sig" },
      body: "{}",
    });
    assert.equal(res.status, 200);
    assert.equal(paymentFailedCalls, 1);
  });

  it("POST /api/stripe/webhook returns 400 for invalid signature at API layer", async () => {
    await closeTestServer(server);
    server = null;

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

    const started = await startTestServer(app);
    server = started.server;
    const webhookBaseUrl = started.baseUrl;

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
    await closeTestServer(server);
    server = null;

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

    const started = await startTestServer(unauthApp);
    server = started.server;
    const unauthBaseUrl = started.baseUrl;

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
