import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { createAdminRouter } from "../admin";

type AdminRole = "ADMIN" | "USER";

describe("admin routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  const users = [
    {
      id: "admin-user",
      email: "admin@example.com",
      tier: "PRO_PLUS",
      role: "ADMIN" as AdminRole,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      lastLoginAt: new Date("2026-05-16T08:00:00.000Z"),
    },
    {
      id: "free-user",
      email: "free@example.com",
      tier: "FREE",
      role: "USER" as AdminRole,
      createdAt: new Date("2026-05-16T08:00:00.000Z"),
      lastLoginAt: null,
    },
    {
      id: "pro-user",
      email: "pro@example.com",
      tier: "PRO",
      role: "USER" as AdminRole,
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      lastLoginAt: new Date("2026-05-16T09:30:00.000Z"),
    },
  ];

  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = users.find((item) => item.id === where.id);
        return user ? { id: user.id, role: user.role } : null;
      },
      count: async ({ where }: { where?: { tier?: string; createdAt?: { gte: Date } } } = {}) => {
        let filtered = users;
        if (where?.tier) {
          filtered = filtered.filter((user) => user.tier === where.tier);
        }
        const createdAtGte = where?.createdAt?.gte;
        if (createdAtGte) {
          filtered = filtered.filter((user) => user.createdAt >= createdAtGte);
        }
        return filtered.length;
      },
      findMany: async ({
        skip,
        take,
      }: {
        skip?: number;
        take?: number;
      }) => users.slice(skip ?? 0, (skip ?? 0) + (take ?? users.length)),
      update: async ({ where, data }: { where: { id: string }; data: { tier: string } }) => {
        const idx = users.findIndex((user) => user.id === where.id);
        if (idx < 0) throw new Error("missing user");
        users[idx] = { ...users[idx], tier: data.tier };
        return users[idx];
      },
    },
    signal: { count: async () => 41 },
    virtualTrade: { count: async () => 11 },
    paperTrade: { count: async () => 7 },
    affiliateClick: { count: async () => 129 },
    affiliateConversion: { count: async () => 14 },
    dlqEvent: {
      findMany: async () => [
        { id: 3, jobId: "job-3", ticker: "AAPL", attempt: 2, status: "failed", createdAt: new Date() },
        { id: 2, jobId: "job-2", ticker: "MSFT", attempt: 1, status: "failed", createdAt: new Date() },
      ],
    },
  };

  const fakeRequireAuth = (req: Request, _res: Response, next: NextFunction): void => {
    const userId = String(req.headers["x-user-id"] ?? "admin-user");
    (req as Request & { auth?: { userId: string; email: string } }).auth = {
      userId,
      email: `${userId}@example.com`,
    };
    next();
  };

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createAdminRouter({
        db,
        requireAuthMiddleware: fakeRequireAuth,
        now: () => new Date("2026-05-17T12:00:00.000Z"),
      }),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const activeServer = server;
    if (!activeServer) throw new Error("Cannot start test server");
    const addr = activeServer.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("GET /api/admin/stats returns summary counters for admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, number>;
    assert.equal(body.totalUsers, 3);
    assert.equal(body.freeUsers, 1);
    assert.equal(body.proUsers, 1);
    assert.equal(body.proPlusUsers, 1);
    assert.equal(body.totalSignals, 41);
    assert.equal(body.totalTrades, 18);
    assert.equal(body.affiliateClicks, 129);
    assert.equal(body.affiliateConversions, 14);
  });

  it("GET /api/admin/stats returns 403 for non-admin users", async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { "x-user-id": "free-user" },
    });
    assert.equal(res.status, 403);
  });

  it("GET /api/admin/users paginates and returns selected fields", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users?page=1&limit=2`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { users: Array<Record<string, unknown>>; page: number; limit: number };
    assert.equal(body.page, 1);
    assert.equal(body.limit, 2);
    assert.equal(body.users.length, 2);
    assert.equal(typeof body.users[0]?.email, "string");
  });

  it("POST /api/admin/user/:id/tier updates user's tier", async () => {
    const res = await fetch(`${baseUrl}/api/admin/user/free-user/tier`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "admin-user",
      },
      body: JSON.stringify({ tier: "PRO_PLUS" }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { user: { tier: string } };
    assert.equal(body.user.tier, "PRO_PLUS");
  });

  it("GET /api/admin/errors returns latest dlq entries", async () => {
    const res = await fetch(`${baseUrl}/api/admin/errors`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { errors: Array<{ id: number }> };
    assert.equal(Array.isArray(body.errors), true);
    assert.equal(body.errors.length, 2);
    assert.equal(body.errors[0]?.id, 3);
  });
});
