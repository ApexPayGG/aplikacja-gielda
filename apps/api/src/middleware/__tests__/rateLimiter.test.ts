import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createRateLimiterMiddleware } from "../rateLimiter";

describe("rate limiter middleware", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  async function startServer(): Promise<void> {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(
      createRateLimiterMiddleware({
        getUserTier: async (userId) => {
          if (userId === "pro-user") return "PRO";
          if (userId === "plus-user") return "PRO_PLUS";
          return "FREE";
        },
      }),
    );

    app.post("/api/auth/login", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/register", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/forgot-password", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/resend-verification", (_req, res) => res.json({ ok: true }));
    app.post("/api/contact", (_req, res) => res.json({ ok: true }));
    app.post("/api/stripe/create-checkout-session", (_req, res) => res.json({ ok: true }));
    app.get("/api/premium/signal", (_req, res) => res.json({ ok: true }));

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("limits /api/auth/login to 5 attempts per 15 minutes per IP", async () => {
    for (let i = 0; i < 5; i++) {
      const okRes = await fetch(`${baseUrl}/api/auth/login`, { method: "POST" });
      assert.equal(okRes.status, 200);
    }

    const blocked = await fetch(`${baseUrl}/api/auth/login`, { method: "POST" });
    assert.equal(blocked.status, 429);
  });

  it("limits /api/auth/register and /api/auth/forgot-password to 3 attempts per hour per IP", async () => {
    for (let i = 0; i < 3; i++) {
      const registerRes = await fetch(`${baseUrl}/api/auth/register`, { method: "POST" });
      assert.equal(registerRes.status, 200);
    }
    const blockedRegister = await fetch(`${baseUrl}/api/auth/register`, { method: "POST" });
    assert.equal(blockedRegister.status, 429);

    for (let i = 0; i < 3; i++) {
      const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, { method: "POST" });
      assert.equal(forgotRes.status, 200);
    }
    const blockedForgot = await fetch(`${baseUrl}/api/auth/forgot-password`, { method: "POST" });
    assert.equal(blockedForgot.status, 429);

    for (let i = 0; i < 3; i++) {
      const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, { method: "POST" });
      assert.equal(resendRes.status, 200);
    }
    const blockedResend = await fetch(`${baseUrl}/api/auth/resend-verification`, { method: "POST" });
    assert.equal(blockedResend.status, 429);
  });

  it("limits /api/contact to 3 attempts per hour per IP", async () => {
    for (let i = 0; i < 3; i++) {
      const contactRes = await fetch(`${baseUrl}/api/contact`, { method: "POST" });
      assert.equal(contactRes.status, 200);
    }

    const blocked = await fetch(`${baseUrl}/api/contact`, { method: "POST" });
    assert.equal(blocked.status, 429);
  });

  it("limits /api/stripe/* to 10 requests per minute per user", async () => {
    for (let i = 0; i < 10; i++) {
      const okRes = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "stripe-user-1" }),
      });
      assert.equal(okRes.status, 200);
    }

    const blocked = await fetch(`${baseUrl}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "stripe-user-1" }),
    });
    assert.equal(blocked.status, 429);
  });

  it("enforces monthly /api/premium/* limits by subscription tier", async () => {
    for (let i = 0; i < 10; i++) {
      const okRes = await fetch(`${baseUrl}/api/premium/signal?userId=free-user`);
      assert.equal(okRes.status, 200);
    }
    const blockedFree = await fetch(`${baseUrl}/api/premium/signal?userId=free-user`);
    assert.equal(blockedFree.status, 429);

    for (let i = 0; i < 60; i++) {
      const okRes = await fetch(`${baseUrl}/api/premium/signal?userId=pro-user`);
      assert.equal(okRes.status, 200);
    }

    for (let i = 0; i < 60; i++) {
      const plusRes = await fetch(`${baseUrl}/api/premium/signal?userId=plus-user`);
      assert.equal(plusRes.status, 200);
    }
  });
});
