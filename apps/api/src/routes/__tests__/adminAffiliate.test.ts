import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { createAdminAffiliateRouter } from "../adminAffiliate";

type AdminRole = "ADMIN" | "USER";

describe("admin affiliate routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  const users = [
    { id: "admin-user", role: "ADMIN" as AdminRole },
    { id: "free-user", role: "USER" as AdminRole },
  ];

  const brokers = [{ id: "broker-etoro", slug: "etoro", displayName: "eToro", priority: 30 }];

  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = users.find((item) => item.id === where.id);
        return user ? { role: user.role } : null;
      },
    },
    affiliateBroker: {
      findMany: async () => brokers,
      findUnique: async () => null,
      create: async () => {
        throw new Error("not implemented in test");
      },
      update: async () => {
        throw new Error("not implemented in test");
      },
      delete: async () => {
        throw new Error("not implemented in test");
      },
    },
    affiliateClick: {
      count: async () => 0,
      groupBy: async () => [],
      findUnique: async () => null,
    },
    affiliateConversion: {
      findMany: async () => [],
      groupBy: async () => [],
      create: async () => {
        throw new Error("not implemented in test");
      },
    },
  };

  const fakeRequireAuth = (req: Request, _res: Response, next: NextFunction): void => {
    const userId = String(req.headers["x-user-id"] ?? "").trim();
    if (!userId) {
      _res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as Request & { auth: { userId: string; email: string } }).auth = {
      userId,
      email: `${userId}@example.com`,
    };
    next();
  };

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createAdminAffiliateRouter({
        db: db as never,
        requireAuthMiddleware: fakeRequireAuth,
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

  it("GET /api/admin/affiliate/brokers returns brokers for admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/affiliate/brokers`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { brokers: Array<{ slug: string }> };
    assert.equal(body.brokers.length, 1);
    assert.equal(body.brokers[0]?.slug, "etoro");
  });

  it("GET /api/admin/affiliate/brokers returns 403 for non-admin users", async () => {
    const res = await fetch(`${baseUrl}/api/admin/affiliate/brokers`, {
      headers: { "x-user-id": "free-user" },
    });
    assert.equal(res.status, 403);
  });

  it("GET /api/admin/affiliate/brokers returns 401 without auth", async () => {
    const res = await fetch(`${baseUrl}/api/admin/affiliate/brokers`);
    assert.equal(res.status, 401);
  });
});
