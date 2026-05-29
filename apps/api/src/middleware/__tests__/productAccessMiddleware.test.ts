import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { requireAuth } from "../../modules/auth/authMiddleware";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createRequireActiveAccess, TRIAL_EXPIRED_RESPONSE } from "../requireActiveAccess";
import {
  isPublicApiPath,
  requireProductAccessForApi,
  useProductRouter,
} from "../productAccessMiddleware";
import { createSignalsListRouter } from "../../routes/signalsList";
import { withTestServer } from "../../testHelpers/httpServer";

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
      return null;
    },
  },
} as never;

describe("productAccessMiddleware", () => {
  const oldSecret = process.env.JWT_SECRET;

  before(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  after(() => {
    process.env.JWT_SECRET = oldSecret;
  });

  it("isPublicApiPath allows company search and brief preview paths", () => {
    assert.equal(isPublicApiPath("/api/companies/search"), true);
    assert.equal(isPublicApiPath("/api/companies/AAPL"), true);
    assert.equal(isPublicApiPath("/api/companies/AAPL/brief"), true);
    assert.equal(isPublicApiPath("/api/signals"), false);
  });

  it("GET /health is public when registered before requireProductAccessForApi", async () => {
    const app = express();
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
    app.use(requireProductAccessForApi);
    useProductRouter(app, createSignalsListRouter());

    await withTestServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { status: string };
      assert.equal(body.status, "ok");
    });
  });

  it("GET /api/signals without token returns 401", async () => {
    const app = express();
    app.use(requireProductAccessForApi);
    useProductRouter(app, createSignalsListRouter());

    await withTestServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/signals`);
      assert.equal(res.status, 401);
    });
  });

  it("GET /api/signals with expired trial returns 403 TRIAL_EXPIRED", async () => {
    const app = express();
    const access = createRequireActiveAccess({ db: mockDb });
    const token = signAuthToken({ sub: "user-expired", email: "exp@example.com" });

    app.use((req, res, next) => {
      if (!req.path.startsWith("/api/")) return next();
      if (req.path === "/api/signals") {
        return requireAuth(req, res, () => access(req, res, next));
      }
      return requireProductAccessForApi(req, res, next);
    });
    useProductRouter(app, createSignalsListRouter());

    await withTestServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/signals`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), TRIAL_EXPIRED_RESPONSE);
    });
  });
});
