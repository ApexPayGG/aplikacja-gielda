import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createStripeRouter } from "../stripe";

describe("stripe routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let completedCalls = 0;
  let deletedCalls = 0;

  beforeEach(async () => {
    completedCalls = 0;
    deletedCalls = 0;

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
        createCheckoutSessionFn: async ({ userId, plan, billing }) => {
          if (userId === "cfg") {
            throw new Error("STRIPE_SECRET_KEY is not set");
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
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("POST /api/stripe/create-checkout-session returns URL", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "u-1", plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { url: string };
    assert.equal(body.url, "https://checkout.stripe.test/u-1/pro/monthly");
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

  it("POST /api/stripe/create-checkout-session returns 503 for Stripe config error", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "cfg", plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Stripe is not configured. Set required STRIPE_* environment variables.");
  });

  it("POST /api/stripe/create-checkout-session keeps non-config errors as 500", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "boom", plan: "pro", billing: "monthly" }),
    });
    assert.equal(res.status, 500);
  });

  it("GET /api/stripe/subscription/:userId returns subscription", async () => {
    const res = await fetch(`${baseUrl}/api/stripe/subscription/u-1`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      tier: string;
      status: string;
      currentPeriodEnd: string | null;
    };
    assert.equal(body.tier, "PRO");
    assert.equal(body.status, "active");
    assert.equal(body.currentPeriodEnd, "2026-12-01T00:00:00.000Z");
  });
});
