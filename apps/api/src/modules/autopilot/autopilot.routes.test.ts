import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import type { Prisma } from "@prisma/client";
import { signAuthToken } from "../../modules/auth/authJwt";
import {
  createAutopilotRouter,
  type AutopilotSettingsRow,
} from "./autopilot.routes";

const PRO_PLUS_USER = "pro-user";

function makeSettings(overrides: Partial<AutopilotSettingsRow> = {}): AutopilotSettingsRow {
  return {
    isAutopilotEnabled: false,
    alpacaMode: "PAPER",
    alpacaApiKeyEncrypted: null,
    alpacaApiSecretEncrypted: null,
    maxCapitalPerTradePct: { toString: () => "0.02" } as Prisma.Decimal,
    maxDailyDrawdownPct: { toString: () => "0.05" } as Prisma.Decimal,
    createdAt: new Date("2026-05-22T12:00:00.000Z"),
    updatedAt: new Date("2026-05-22T12:00:00.000Z"),
    ...overrides,
  };
}

describe("autopilot routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let authToken = "";
  let settingsStore: AutopilotSettingsRow | null = null;
  const oldSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: PRO_PLUS_USER, email: "pro@example.com" });
    settingsStore = null;

    const app = express();
    app.use(express.json());
    app.use(
      createAutopilotRouter({
        requirePlanProPlus: (_req, _res, next) => next(),
        crypto: {
          encrypt: (plainText: string) => `enc:${plainText}`,
        },
        db: {
          userAutopilotSettings: {
            findUnique: async () => settingsStore,
            upsert: async ({ create, update }: {
              create: Partial<AutopilotSettingsRow> & { userId: string };
              update: Partial<AutopilotSettingsRow>;
            }) => {
              settingsStore = makeSettings({
                ...(settingsStore ?? {}),
                ...create,
                ...update,
              });
              return settingsStore;
            },
          },
          userAutopilotStats: {
            findUnique: async () => null,
          },
        } as never,
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

  it("GET /api/v1/autopilot/settings does not return plaintext or encrypted keys", async () => {
    settingsStore = makeSettings({
      alpacaApiKeyEncrypted: "enc:PK123",
      alpacaApiSecretEncrypted: "enc:SECRET456",
    });

    const res = await fetch(`${baseUrl}/api/v1/autopilot/settings`, {
      headers: { authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);

    const bodyText = await res.text();
    assert.ok(!bodyText.includes("PK123"));
    assert.ok(!bodyText.includes("SECRET456"));
    assert.ok(!bodyText.includes("enc:PK123"));
    assert.ok(!bodyText.includes("alpacaApiKeyEncrypted"));

    const body = JSON.parse(bodyText) as {
      settings: {
        hasAlpacaApiKey: boolean;
        hasAlpacaApiSecret: boolean;
      };
    };
    assert.equal(body.settings.hasAlpacaApiKey, true);
    assert.equal(body.settings.hasAlpacaApiSecret, true);
  });

  it("POST /api/v1/autopilot/toggle blocks enable without Alpaca keys", async () => {
    settingsStore = makeSettings();

    const res = await fetch(`${baseUrl}/api/v1/autopilot/toggle`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "MISSING_ALPACA_KEYS");
  });

  it("POST /api/v1/autopilot/settings rejects maxCapitalPerTradePct above 0.10", async () => {
    const res = await fetch(`${baseUrl}/api/v1/autopilot/settings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ maxCapitalPerTradePct: "0.15" }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /maxCapitalPerTradePct must not exceed 0\.1/);
  });
});
