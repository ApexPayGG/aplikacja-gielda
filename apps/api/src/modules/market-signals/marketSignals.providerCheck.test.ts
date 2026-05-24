import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { ADMIN_OR_INTERNAL_REQUIRED_RESPONSE } from "../../middleware/requireAdminOrInternal";
import type { AuthenticatedRequest } from "../auth/authMiddleware";
import { createMarketSignalsRouter } from "./marketSignals.routes";
import {
  buildMarketSignalsProviderCheck,
  checkEodhdProvider,
  checkPolygonProvider,
  checkSecProvider,
} from "./marketSignals.providerCheck";

const FIXED_NOW = new Date("2026-05-24T12:00:00.000Z");

type MockResponse = {
  status: number;
  body: string;
};

function createMockFetch(handlers: Record<string, MockResponse>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    for (const [pattern, result] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return {
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          text: async () => result.body,
        } as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      text: async () => "not found",
    } as Response;
  }) as typeof fetch;
}

describe("marketSignals.providerCheck", () => {
  it("returns MISSING_API_KEY and usableForMarketSignals false when Polygon key is missing", async () => {
    const result = await checkPolygonProvider("AAPL", {
      getEnv: () => undefined,
      fetchFn: createMockFetch({}),
      now: () => FIXED_NOW,
    });

    assert.equal(result.apiKeyConfigured, false);
    assert.equal(result.referenceTicker.errorCode, "MISSING_API_KEY");
    assert.equal(result.tradesEndpoint.errorCode, "MISSING_API_KEY");
    assert.equal(result.usableForMarketSignals, false);
  });

  it("treats Polygon reference 200 with trades/options 403 as not entitled", async () => {
    const fetchFn = createMockFetch({
      "/v3/reference/tickers/": { status: 200, body: '{"results":{"ticker":"AAPL"}}' },
      "/v3/trades/": { status: 403, body: '{"status":"NOT_AUTHORIZED"}' },
      "/v3/snapshot/options/": { status: 403, body: '{"status":"NOT_AUTHORIZED"}' },
    });

    const result = await checkPolygonProvider("AAPL", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn,
      now: () => FIXED_NOW,
    });

    assert.equal(result.referenceTicker.httpStatus, 200);
    assert.equal(result.referenceTicker.ok, true);
    assert.equal(result.tradesEndpoint.httpStatus, 403);
    assert.equal(result.tradesEndpoint.entitled, false);
    assert.equal(result.optionsSnapshotEndpoint.httpStatus, 403);
    assert.equal(result.optionsSnapshotEndpoint.entitled, false);
    assert.equal(result.usableForMarketSignals, false);
  });

  it("marks Polygon usableForMarketSignals true when trades endpoint returns 200", async () => {
    const fetchFn = createMockFetch({
      "/v3/reference/tickers/": { status: 200, body: '{"results":{"ticker":"AAPL"}}' },
      "/v3/trades/": { status: 200, body: '{"results":[]}' },
      "/v3/snapshot/options/": { status: 403, body: '{"status":"NOT_AUTHORIZED"}' },
    });

    const result = await checkPolygonProvider("AAPL", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn,
      now: () => FIXED_NOW,
    });

    assert.equal(result.tradesEndpoint.entitled, true);
    assert.equal(result.usableForMarketSignals, true);
  });

  it("adds invalid key warning when Polygon returns 401", async () => {
    const fetchFn = createMockFetch({
      "/v3/reference/tickers/": { status: 401, body: '{"status":"Unauthorized"}' },
      "/v3/trades/": { status: 401, body: '{"status":"Unauthorized"}' },
      "/v3/snapshot/options/": { status: 401, body: '{"status":"Unauthorized"}' },
    });

    const response = await buildMarketSignalsProviderCheck({
      provider: "POLYGON",
      ticker: "AAPL",
      deps: {
        getEnv: (key) => (key === "POLYGON_API_KEY" ? "bad-key" : undefined),
        fetchFn,
        now: () => FIXED_NOW,
      },
    });

    assert.equal(response.checks.polygon?.referenceTicker.errorCode, "HTTP_401");
    assert.ok(response.warnings.includes("POLYGON_API_KEY appears invalid (HTTP 401)."));
  });

  it("returns EODHD usable true with hasData false for empty array", async () => {
    const fetchFn = createMockFetch({
      "insider-transactions": { status: 200, body: "[]" },
    });

    const result = await checkEodhdProvider("AAPL", {
      getEnv: (key) => (key === "EODHD_API_KEY" ? "eod-key" : undefined),
      fetchFn,
      now: () => FIXED_NOW,
    });

    assert.equal(result.insiderActivityEndpoint.ok, true);
    assert.equal(result.insiderActivityEndpoint.hasData, false);
    assert.equal(result.usableForMarketSignals, true);
  });

  it("returns EODHD usable true with hasData true for non-empty array", async () => {
    const fetchFn = createMockFetch({
      "insider-transactions": { status: 200, body: '[{"owner":"Jane Doe"}]' },
    });

    const result = await checkEodhdProvider("AAPL", {
      getEnv: (key) => (key === "EODHD_API_KEY" ? "eod-key" : undefined),
      fetchFn,
      now: () => FIXED_NOW,
    });

    assert.equal(result.insiderActivityEndpoint.hasData, true);
    assert.equal(result.usableForMarketSignals, true);
  });

  it("returns SEC usable false when user agent is missing", async () => {
    const result = await checkSecProvider("AAPL", {
      getEnv: () => undefined,
      fetchFn: createMockFetch({}),
      now: () => FIXED_NOW,
    });

    assert.equal(result.userAgentConfigured, false);
    assert.equal(result.usableForMarketSignals, false);
    assert.equal(result.submissionsEndpoint.checked, false);
  });

  it("runs all provider checks when provider=ALL", async () => {
    const fetchFn = createMockFetch({
      "/v3/reference/tickers/": { status: 200, body: '{"results":{"ticker":"AAPL"}}' },
      "/v3/trades/": { status: 403, body: '{"status":"NOT_AUTHORIZED"}' },
      "/v3/snapshot/options/": { status: 403, body: '{"status":"NOT_AUTHORIZED"}' },
      "insider-transactions": { status: 200, body: "[]" },
      "company_tickers.json": {
        status: 200,
        body: JSON.stringify({ "0": { ticker: "AAPL", cik_str: 320193 } }),
      },
      "/submissions/CIK": { status: 200, body: '{"filingsRecent":{}}' },
    });

    const response = await buildMarketSignalsProviderCheck({
      provider: "ALL",
      ticker: "AAPL",
      deps: {
        getEnv: (key) => {
          if (key === "POLYGON_API_KEY") return "poly-key";
          if (key === "EODHD_API_KEY") return "eod-key";
          if (key === "SEC_USER_AGENT") return "StockAI/1.0 contact@example.com";
          return undefined;
        },
        fetchFn,
        now: () => FIXED_NOW,
      },
    });

    assert.ok(response.checks.polygon);
    assert.ok(response.checks.eodhd);
    assert.ok(response.checks.sec);
    assert.equal(response.ticker, "AAPL");
  });

  it("does not expose secrets in response", async () => {
    const secret = "super-secret-polygon-key-12345";
    const fetchFn = createMockFetch({
      "/v3/reference/tickers/": { status: 200, body: '{"results":{"ticker":"AAPL"}}' },
      "/v3/trades/": { status: 200, body: '{"results":[]}' },
      "/v3/snapshot/options/": { status: 200, body: '{"results":[]}' },
    });

    const response = await buildMarketSignalsProviderCheck({
      provider: "POLYGON",
      ticker: "AAPL",
      deps: {
        getEnv: (key) => (key === "POLYGON_API_KEY" ? secret : undefined),
        fetchFn,
        now: () => FIXED_NOW,
      },
    });

    const serialized = JSON.stringify(response);
    assert.ok(!serialized.includes(secret));
    assert.ok(!serialized.includes("apiKey="));
    assert.ok(!serialized.includes("api_token="));
  });
});

describe("marketSignals ops/provider-check route", () => {
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
        runProviderCheck: async ({ provider, ticker }) => ({
          ok: true,
          generatedAt: FIXED_NOW.toISOString(),
          ticker,
          checks: provider === "ALL" ? { polygon: { apiKeyConfigured: true } as never } : {},
          warnings: [],
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

  it("returns 400 for invalid provider query", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/ops/provider-check?provider=UNKNOWN`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "provider must be one of POLYGON, EODHD, SEC, or ALL",
    });
  });

  it("requires admin/internal guard for provider-check endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/ops/provider-check?provider=POLYGON`);
    assert.equal(res.status, 200);
    assert.equal(adminGuardCalls, 1);
  });

  it("rejects provider-check without admin/internal access", async () => {
    const guarded = express();
    guarded.use(express.json());
    guarded.use(
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
        runProviderCheck: async () => ({
          ok: true,
          generatedAt: FIXED_NOW.toISOString(),
          ticker: "AAPL",
          checks: {},
          warnings: [],
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
      server = guarded.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    const guardedBaseUrl = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${guardedBaseUrl}/api/v1/market-signals/ops/provider-check?provider=POLYGON`);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
  });
});
