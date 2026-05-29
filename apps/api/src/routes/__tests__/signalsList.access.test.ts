import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { requireAuth } from "../../modules/auth/authMiddleware";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createRequireActiveAccess, TRIAL_EXPIRED_RESPONSE } from "../../middleware/requireActiveAccess";
import { productAccessMiddleware } from "../../middleware/productAccessMiddleware";
import { createSignalsListRouter } from "../signalsList";
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

describe("signalsList access hardening", () => {
  const oldSecret = process.env.JWT_SECRET;

  before(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  after(() => {
    process.env.JWT_SECRET = oldSecret;
  });

  it("returns 401 without auth token", async () => {
    const app = express();
    app.use(...productAccessMiddleware, createSignalsListRouter());

    await withTestServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/signals`);
      assert.equal(res.status, 401);
    });
  });

  it("returns 403 TRIAL_EXPIRED for expired trial user", async () => {
    const app = express();
    const access = createRequireActiveAccess({ db: mockDb });
    const token = signAuthToken({ sub: "user-expired", email: "exp@example.com" });
    app.use(requireAuth, access, createSignalsListRouter());

    await withTestServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/signals`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), TRIAL_EXPIRED_RESPONSE);
    });
  });
});
