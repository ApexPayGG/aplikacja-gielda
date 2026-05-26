import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { Request, Response } from "express";
import express from "express";
import type { AuthenticatedRequest } from "../../modules/auth/authMiddleware";
import { optionalAuth } from "../../modules/auth/authMiddleware";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createRequireActiveAccess, TRIAL_EXPIRED_RESPONSE } from "../requireActiveAccess";

const mockDb = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (where.id === "user-expired") {
        return {
          id: "user-expired",
          role: "USER",
          tier: "FREE",
          subscriptionStatus: "free",
          trialStartedAt: new Date("2026-05-01T00:00:00.000Z"),
          trialEndsAt: new Date("2026-05-10T00:00:00.000Z"),
          trialKind: "without_card",
        };
      }
      if (where.id === "user-active") {
        return {
          id: "user-active",
          role: "USER",
          tier: "FREE",
          subscriptionStatus: "free",
          trialStartedAt: new Date(),
          trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          trialKind: "without_card",
        };
      }
      return null;
    },
  },
} as never;

async function invokeMiddleware(
  req: Request,
  middleware: ReturnType<typeof createRequireActiveAccess>,
): Promise<{ status: number; body: unknown; nextCalled: boolean }> {
  let status = 200;
  let body: unknown = null;
  let nextCalled = false;

  await new Promise<void>((resolve) => {
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        resolve();
        return this;
      },
    } as Response;

    void middleware(req, res, () => {
      nextCalled = true;
      resolve();
    });
  });

  return { status, body, nextCalled };
}

describe("requireActiveAccess middleware", () => {
  it("returns 403 TRIAL_EXPIRED for expired trial user", async () => {
    const req = {
      auth: { userId: "user-expired", email: "expired@example.com" },
    } as AuthenticatedRequest;

    const middleware = createRequireActiveAccess({ db: mockDb });

    const result = await invokeMiddleware(req, middleware);
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, TRIAL_EXPIRED_RESPONSE);
    assert.equal(result.nextCalled, false);
  });

  it("allows active trial user", async () => {
    const req = {
      auth: { userId: "user-active", email: "active@example.com" },
    } as AuthenticatedRequest;

    const middleware = createRequireActiveAccess({ db: mockDb });

    const result = await invokeMiddleware(req, middleware);
    assert.equal(result.status, 200);
    assert.equal(result.nextCalled, true);
  });
});

describe("requireActiveAccessIfAuthenticated (allowAnonymous)", () => {
  it("passes anonymous requests without checking access", async () => {
    const req = {} as Request;
    const middleware = createRequireActiveAccess({ db: mockDb }, { allowAnonymous: true });

    const result = await invokeMiddleware(req, middleware);
    assert.equal(result.status, 200);
    assert.equal(result.nextCalled, true);
  });

  it("returns 403 TRIAL_EXPIRED for authenticated expired trial user", async () => {
    const req = {
      auth: { userId: "user-expired", email: "expired@example.com" },
    } as AuthenticatedRequest;
    const middleware = createRequireActiveAccess({ db: mockDb }, { allowAnonymous: true });

    const result = await invokeMiddleware(req, middleware);
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, TRIAL_EXPIRED_RESPONSE);
    assert.equal(result.nextCalled, false);
  });

  it("allows authenticated active trial user", async () => {
    const req = {
      auth: { userId: "user-active", email: "active@example.com" },
    } as AuthenticatedRequest;
    const middleware = createRequireActiveAccess({ db: mockDb }, { allowAnonymous: true });

    const result = await invokeMiddleware(req, middleware);
    assert.equal(result.status, 200);
    assert.equal(result.nextCalled, true);
  });
});

describe("optionalAuth before requireActiveAccessIfAuthenticated", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const oldJwtSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    const app = express();
    const accessMiddleware = createRequireActiveAccess({ db: mockDb }, { allowAnonymous: true });
    app.get("/api/brief/:symbol", optionalAuth, accessMiddleware, (_req, res) => {
      res.json({ ok: true });
    });

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

  it("allows anonymous optional route access", async () => {
    const res = await fetch(`${baseUrl}/api/brief/AAPL`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it("blocks expired authenticated user on optional route", async () => {
    const token = signAuthToken({ sub: "user-expired", email: "expired@example.com" });
    const res = await fetch(`${baseUrl}/api/brief/AAPL`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), TRIAL_EXPIRED_RESPONSE);
  });

  it("allows active trial authenticated user on optional route", async () => {
    const token = signAuthToken({ sub: "user-active", email: "active@example.com" });
    const res = await fetch(`${baseUrl}/api/brief/AAPL`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
});
