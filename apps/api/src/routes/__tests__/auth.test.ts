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
          user: { id: "u-1", email, name: name ?? null, tier: "FREE" },
          token: "register-token",
        }),
        loginFn: async ({ email, password }) => {
          if (email === "bad@example.com" || password !== "password123") {
            throw new Error("Invalid credentials");
          }
          return {
            user: { id: "u-1", email, name: "Jan", tier: "FREE" },
            token: "login-token",
          };
        },
        getUserByIdFn: async (id) => (id === "u-1" ? { id, email: "jan@example.com", name: "Jan", tier: "FREE" } : null),
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

  it("POST /api/auth/register returns user and token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "jan@example.com", password: "password123", name: "Jan" }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { user: { email: string }; token: string };
    assert.equal(body.user.email, "jan@example.com");
    assert.equal(body.token, "register-token");
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
});
