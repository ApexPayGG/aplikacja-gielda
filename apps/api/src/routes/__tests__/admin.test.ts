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

  const affiliateBrokers = [
    { id: "broker-etoro", slug: "etoro" },
    { id: "broker-xtb", slug: "xtb" },
  ];

  const affiliateClicks = [
    {
      id: "click-1",
      brokerId: "broker-etoro",
      language: "pl",
      sourcePage: "signals",
      clickedAt: new Date("2026-05-17T08:00:00.000Z"),
    },
    {
      id: "click-2",
      brokerId: "broker-xtb",
      language: "en",
      sourcePage: "company",
      clickedAt: new Date("2026-05-16T08:00:00.000Z"),
    },
    {
      id: "click-3",
      brokerId: "broker-etoro",
      language: "pl",
      sourcePage: "landing",
      clickedAt: new Date("2026-05-15T08:00:00.000Z"),
    },
    {
      id: "click-4",
      brokerId: "broker-xtb",
      language: "de",
      sourcePage: "signals",
      clickedAt: new Date("2026-05-14T08:00:00.000Z"),
    },
    {
      id: "click-5",
      brokerId: "broker-xtb",
      language: "en",
      sourcePage: "signals",
      clickedAt: new Date("2026-05-13T08:00:00.000Z"),
    },
    {
      id: "click-6",
      brokerId: "broker-etoro",
      language: "pl",
      sourcePage: "company",
      clickedAt: new Date("2026-05-12T08:00:00.000Z"),
    },
    {
      id: "click-7",
      brokerId: "broker-etoro",
      language: "en",
      sourcePage: "landing",
      clickedAt: new Date("2026-05-11T08:00:00.000Z"),
    },
    {
      id: "click-8",
      brokerId: "broker-xtb",
      language: "pl",
      sourcePage: "signals",
      clickedAt: new Date("2026-05-10T08:00:00.000Z"),
    },
    {
      id: "click-9",
      brokerId: "broker-xtb",
      language: "de",
      sourcePage: "landing",
      clickedAt: new Date("2026-05-01T08:00:00.000Z"),
    },
    {
      id: "click-10",
      brokerId: "broker-etoro",
      language: "en",
      sourcePage: "company",
      clickedAt: new Date("2026-04-10T08:00:00.000Z"),
    },
  ];

  const applyClickWhere = (
    rows: typeof affiliateClicks,
    where?: { clickedAt?: { gte?: Date } },
  ) => {
    const clickedAtGte = where?.clickedAt?.gte;
    if (!clickedAtGte) return rows;
    return rows.filter((row) => row.clickedAt >= clickedAtGte);
  };

  const sortClicks = (rows: typeof affiliateClicks, order?: { clickedAt?: "asc" | "desc" }) => {
    if (!order?.clickedAt) return rows;
    const multiplier = order.clickedAt === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => (a.clickedAt.getTime() - b.clickedAt.getTime()) * multiplier);
  };

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
    affiliateClick: {
      count: async ({ where }: { where?: { clickedAt?: { gte?: Date } } } = {}) =>
        applyClickWhere(affiliateClicks, where).length,
      groupBy: async ({
        by,
        where,
        _count,
      }: {
        by: Array<"brokerId" | "language" | "sourcePage">;
        where?: { clickedAt?: { gte?: Date } };
        _count?: { _all: true };
      }) => {
        void _count;
        const key = by[0];
        const map = new Map<string, number>();
        for (const row of applyClickWhere(affiliateClicks, where)) {
          const rawValue =
            key === "brokerId" ? row.brokerId : key === "language" ? row.language : row.sourcePage;
          const normalized = rawValue ?? null;
          const mapKey = normalized ?? "__null__";
          map.set(mapKey, (map.get(mapKey) ?? 0) + 1);
        }
        return Array.from(map.entries()).map(([value, count]) => ({
          [key]: value === "__null__" ? null : value,
          _count: { _all: count },
        }));
      },
      findMany: async ({
        where,
        skip,
        take,
        orderBy,
        select,
      }: {
        where?: { clickedAt?: { gte?: Date } };
        skip?: number;
        take?: number;
        orderBy?: { clickedAt?: "asc" | "desc" };
        select?: unknown;
      }) => {
        void select;
        const filtered = applyClickWhere(affiliateClicks, where);
        const ordered = sortClicks(filtered, orderBy);
        const paged = ordered.slice(skip ?? 0, (skip ?? 0) + (take ?? ordered.length));
        return paged.map((row) => ({
          id: row.id,
          language: row.language,
          sourcePage: row.sourcePage,
          clickedAt: row.clickedAt,
          broker: {
            slug: affiliateBrokers.find((broker) => broker.id === row.brokerId)?.slug ?? "unknown",
          },
        }));
      },
    },
    affiliateConversion: { count: async () => 14 },
    affiliateBroker: {
      findMany: async ({
        where,
        select,
      }: {
        where: { id: { in: string[] } };
        select: { id: true; slug: true };
      }) => {
        void select;
        const ids = where.id.in;
        return affiliateBrokers.filter((broker) => ids.includes(broker.id));
      },
    },
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
    assert.equal(body.affiliateClicks, affiliateClicks.length);
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

  it("GET /api/admin/affiliate/stats returns aggregate click metrics", async () => {
    const res = await fetch(`${baseUrl}/api/admin/affiliate/stats`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      totalClicks: number;
      clicksByBroker: Record<string, number>;
      clicksByLang: Record<string, number>;
      clicksByPage: Record<string, number>;
      clicksLast7Days: Array<{ date: string; count: number }>;
      clicksLast30Days: number;
    };
    assert.equal(body.totalClicks, 10);
    assert.equal(body.clicksByBroker.etoro, 5);
    assert.equal(body.clicksByBroker.xtb, 5);
    assert.equal(body.clicksByLang.pl, 4);
    assert.equal(body.clicksByLang.en, 4);
    assert.equal(body.clicksByLang.de, 2);
    assert.equal(body.clicksByPage.signals, 4);
    assert.equal(body.clicksByPage.company, 3);
    assert.equal(body.clicksByPage.landing, 3);
    assert.deepEqual(body.clicksLast7Days, [
      { date: "2026-05-11", count: 1 },
      { date: "2026-05-12", count: 1 },
      { date: "2026-05-13", count: 1 },
      { date: "2026-05-14", count: 1 },
      { date: "2026-05-15", count: 1 },
      { date: "2026-05-16", count: 1 },
      { date: "2026-05-17", count: 1 },
    ]);
    assert.equal(body.clicksLast30Days, 9);
  });

  it("GET /api/admin/affiliate/clicks returns paginated click list", async () => {
    const res = await fetch(`${baseUrl}/api/admin/affiliate/clicks?page=1&limit=3`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      page: number;
      limit: number;
      total: number;
      clicks: Array<{
        id: string;
        broker: string;
        lang: string;
        page: string;
        createdAt: string;
      }>;
    };
    assert.equal(body.page, 1);
    assert.equal(body.limit, 3);
    assert.equal(body.total, 10);
    assert.equal(body.clicks.length, 3);
    assert.equal(body.clicks[0]?.id, "click-1");
    assert.equal(body.clicks[0]?.broker, "etoro");
    assert.equal(body.clicks[1]?.id, "click-2");
    assert.equal(body.clicks[1]?.broker, "xtb");
    assert.equal(body.clicks[2]?.id, "click-3");
    assert.equal(body.clicks[2]?.page, "landing");
  });
});
