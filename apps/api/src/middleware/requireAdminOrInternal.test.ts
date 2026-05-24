import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request, type Response } from "express";
import type { AuthenticatedRequest } from "../modules/auth/authMiddleware";
import {
  ADMIN_OR_INTERNAL_REQUIRED_RESPONSE,
  createRequireAdminOrInternal,
  requestHasAdminRole,
  requestHasDevAdminOverride,
  requestHasValidInternalApiKey,
} from "./requireAdminOrInternal";
import { createMarketSignalsRouter } from "../modules/market-signals/marketSignals.routes";

function mockReq(overrides: Partial<Request> & { user?: unknown; auth?: unknown } = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

async function invokeMiddleware(
  req: Request,
  middleware: ReturnType<typeof createRequireAdminOrInternal>,
): Promise<{ status: number; body: unknown; nextCalled: boolean }> {
  let status = 200;
  let body: unknown = null;
  let nextCalled = false;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as Response;

  await new Promise<void>((resolve) => {
    middleware(req, res, () => {
      nextCalled = true;
      resolve();
    });
    if (!nextCalled && status !== 200) resolve();
  });

  return { status, body, nextCalled };
}

describe("requireAdminOrInternal middleware", () => {
  it("allows ADMIN role from req.user.role", async () => {
    const middleware = createRequireAdminOrInternal();
    const result = await invokeMiddleware(
      mockReq({ user: { role: "ADMIN" } }),
      middleware,
    );
    assert.equal(result.nextCalled, true);
    assert.equal(requestHasAdminRole(mockReq({ user: { role: "ADMIN" } })), true);
  });

  it("allows ADMIN role from nested req.user.user.role", async () => {
    const middleware = createRequireAdminOrInternal();
    const result = await invokeMiddleware(
      mockReq({ user: { user: { role: "ADMIN" } } }),
      middleware,
    );
    assert.equal(result.nextCalled, true);
  });

  it("allows valid x-internal-api-key when INTERNAL_API_KEY exists", async () => {
    const middleware = createRequireAdminOrInternal({
      getEnv: (key) => (key === "INTERNAL_API_KEY" ? "secret-token" : undefined),
    });
    const result = await invokeMiddleware(
      mockReq({ headers: { "x-internal-api-key": "secret-token" } }),
      middleware,
    );
    assert.equal(result.nextCalled, true);
    assert.equal(
      requestHasValidInternalApiKey(mockReq({ headers: { "x-internal-api-key": "secret-token" } }), (key) =>
        key === "INTERNAL_API_KEY" ? "secret-token" : undefined,
      ),
      true,
    );
  });

  it("rejects invalid internal key", async () => {
    const middleware = createRequireAdminOrInternal({
      getEnv: (key) => (key === "INTERNAL_API_KEY" ? "secret-token" : undefined),
    });
    const result = await invokeMiddleware(
      mockReq({ headers: { "x-internal-api-key": "wrong-token" } }),
      middleware,
    );
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 403);
  });

  it("rejects missing role and key", async () => {
    const middleware = createRequireAdminOrInternal({
      getEnv: () => undefined,
      nodeEnv: "production",
    });
    const result = await invokeMiddleware(mockReq({ user: { role: "USER" } }), middleware);
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 403);
  });

  it("allows dev override when NODE_ENV is not production", async () => {
    const middleware = createRequireAdminOrInternal({ nodeEnv: "development" });
    const result = await invokeMiddleware(
      mockReq({ headers: { "x-dev-admin-override": "true" } }),
      middleware,
    );
    assert.equal(result.nextCalled, true);
    assert.equal(
      requestHasDevAdminOverride(mockReq({ headers: { "x-dev-admin-override": "true" } }), "development"),
      true,
    );
  });

  it("ignores dev override in production", async () => {
    const middleware = createRequireAdminOrInternal({ nodeEnv: "production" });
    const result = await invokeMiddleware(
      mockReq({ headers: { "x-dev-admin-override": "true" } }),
      middleware,
    );
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 403);
    assert.equal(
      requestHasDevAdminOverride(mockReq({ headers: { "x-dev-admin-override": "true" } }), "production"),
      false,
    );
  });

  it("returns exact expected 403 error shape", async () => {
    const middleware = createRequireAdminOrInternal({ nodeEnv: "production", getEnv: () => undefined });
    const result = await invokeMiddleware(mockReq(), middleware);
    assert.deepEqual(result.body, ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
  });
});

describe("marketSignals routes admin guard", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let adminGuardCalls = 0;

  beforeEach(async () => {
    adminGuardCalls = 0;
    const app = express();
    app.use(express.json());
    app.use(
      createMarketSignalsRouter({
        service: {
          listSignals: async () => ({
            ticker: "AAPL",
            lookbackDays: 30,
            signals: [],
            summary: {
              total: 0,
              byType: {},
              strongestSignalType: null,
              averageConfidenceScore: 0,
              whaleAccumulationDetected: false,
            },
          }),
          ingestSignal: async () => {
            throw new Error("not used");
          },
        } as never,
        ingestionService: {
          parseProviderPayload: () => [],
          ingestProviderPayload: async () => {
            throw new Error("not used");
          },
        },
        enqueueProviderPayload: async () => ({
          queued: true,
          jobId: "job-1",
          provider: "POLYGON_DARK_POOL",
        }),
        fetchAndEnqueueMarketSignal: async () => ({
          queued: true,
          provider: "POLYGON_DARK_POOL",
          ticker: "AAPL",
          fetchOk: true,
          jobId: "job-2",
        }),
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "user-1",
            email: "user@example.com",
          };
          next();
        },
        requireAdminOrInternalMiddleware: (_req, _res, next) => {
          adminGuardCalls += 1;
          next();
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

  it("does not require admin/internal for read endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/AAPL`);
    assert.equal(res.status, 200);
    assert.equal(adminGuardCalls, 0);
  });

  it("requires admin/internal for provider-fetch-enqueue", async () => {
    const withoutGuard = express();
    withoutGuard.use(express.json());
    withoutGuard.use(
      createMarketSignalsRouter({
        service: {
          listSignals: async () => {
            throw new Error("not used");
          },
          ingestSignal: async () => {
            throw new Error("not used");
          },
        } as never,
        ingestionService: {
          parseProviderPayload: () => [],
          ingestProviderPayload: async () => {
            throw new Error("not used");
          },
        },
        fetchAndEnqueueMarketSignal: async () => ({
          queued: false,
          provider: "POLYGON_DARK_POOL",
          ticker: "AAPL",
          fetchOk: false,
        }),
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "user-1",
            email: "user@example.com",
          };
          next();
        },
        requireAdminOrInternalMiddleware: (_req, res) => {
          res.status(403).json(ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
        },
      }),
    );

    await new Promise<void>((resolve) => {
      server = withoutGuard.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const guardedBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${guardedBaseUrl}/api/v1/market-signals/provider-fetch-enqueue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "POLYGON_DARK_POOL", ticker: "AAPL" }),
    });

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
  });
});
