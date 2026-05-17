import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createAuthRouter } from "../auth";

describe("auth routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const oldSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    const app = express();
    app.use(express.json());
    app.use(
      createAuthRouter({
        registerFn: async ({ email, name }) => ({
          user: { id: "u-1", email, name: name ?? null, tier: "FREE", role: "USER" },
          verificationEmailSent: true,
        }),
        loginFn: async ({ email, password }) => {
          if (email === "unverified@example.com") {
            throw new Error("Please verify your email first");
          }
          if (email === "bad@example.com" || password !== "password123") {
            throw new Error("Invalid credentials");
          }
          return {
            user: { id: "u-1", email, name: "Jan", tier: "FREE", role: "USER" },
            token: "login-token",
          };
        },
        verifyEmailFn: async (token) => {
          if (token !== "good-token") {
            throw new Error("Verification token expired or invalid");
          }
        },
        getUserByIdFn: async (id) =>
          id === "u-1"
            ? { id, email: "jan@example.com", name: "Jan", tier: "FREE", role: "USER" }
            : null,
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
    process.env.JWT_SECRET = oldSecret;
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("POST /api/auth/register returns user and verification flag", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "jan@example.com", password: "password123", name: "Jan" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { user: { email: string }; verificationEmailSent: boolean };
    assert.equal(body.user.email, "jan@example.com");
    assert.equal(body.verificationEmailSent, true);
  });

  it("POST /api/auth/login returns 401 for invalid credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bad@example.com", password: "password123" }),
    });
    assert.equal(res.status, 401);
  });

  it("GET /api/auth/me returns user for valid bearer token", async () => {
    const token = signAuthToken({ sub: "u-1", email: "jan@example.com" });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { user: { id: string } };
    assert.equal(body.user.id, "u-1");
  });

  it("GET /api/auth/me returns 401 without bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  it("POST /api/auth/login returns 403 for unverified email", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "unverified@example.com", password: "password123" }),
    });
    assert.equal(res.status, 403);
  });

  it("GET /api/auth/verify returns json for valid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify?token=good-token`, {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { verified: boolean };
    assert.equal(body.verified, true);
  });

  it("GET /api/auth/verify returns 400 for invalid token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify?token=bad-token`, {
      headers: { accept: "application/json" },
    });
    assert.equal(res.status, 400);
  });
});
