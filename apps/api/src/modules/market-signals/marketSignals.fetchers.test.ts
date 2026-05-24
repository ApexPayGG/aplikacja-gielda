import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { signAuthToken } from "../auth/authJwt";
import type { AuthenticatedRequest } from "../auth/authMiddleware";
import {
  fetchAndEnqueueMarketSignal,
  fetchEodhdInsiderActivityPayload,
  fetchPolygonDarkPoolPayload,
  fetchSecFilingsPayload,
  normalizeFetchTicker,
  redactSecretsFromText,
  sanitizeFetchErrorMessage,
} from "./marketSignals.fetchers";
import { buildMarketSignalsJobId } from "./marketSignals.queue";
import { createMarketSignalsRouter } from "./marketSignals.routes";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("marketSignals.fetchers", () => {
  it("returns MISSING_API_KEY for missing POLYGON_API_KEY", async () => {
    const result = await fetchPolygonDarkPoolPayload("AAPL", {
      getEnv: () => undefined,
      fetchFn: async () => jsonResponse(200, { results: [] }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "MISSING_API_KEY");
    assert.deepEqual(result.payload, { results: [] });
  });

  it("returns INVALID_TICKER for invalid ticker input", async () => {
    const result = await fetchPolygonDarkPoolPayload("bad ticker!", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn: async () => jsonResponse(200, { results: [] }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "INVALID_TICKER");
    assert.equal(normalizeFetchTicker("bad ticker!"), null);
  });

  it("returns TIMEOUT when fetch aborts", async () => {
    const result = await fetchPolygonDarkPoolPayload("AAPL", {
      timeoutMs: 5,
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn: async (_url, init) => {
        await new Promise<void>((resolve) => {
          const signal = init?.signal;
          if (signal?.aborted) return resolve();
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        throw new DOMException("Aborted", "AbortError");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "TIMEOUT");
  });

  it("returns HTTP_ERROR with statusCode for HTTP 500", async () => {
    const result = await fetchPolygonDarkPoolPayload("AAPL", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn: async () => jsonResponse(500, { error: "server exploded" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "HTTP_ERROR");
    assert.equal(result.statusCode, 500);
  });

  it("returns ok true with mapped Polygon dark pool payload", async () => {
    const result = await fetchPolygonDarkPoolPayload("AAPL", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "poly-key" : undefined),
      fetchFn: async (url) => {
        assert.match(String(url), /\/v3\/trades\/AAPL/);
        return jsonResponse(200, {
          results: [
            {
              price: 190.12,
              size: 300000,
              trf_id: 201,
              sip_timestamp: 1_718_000_000_000_000_000,
            },
          ],
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.provider, "POLYGON_DARK_POOL");
    const payload = result.payload as { results: Array<Record<string, unknown>> };
    assert.equal(payload.results.length, 1);
    assert.equal(payload.results[0]?.ticker, "AAPL");
    assert.equal(payload.results[0]?.exchange, "DARK");
    assert.equal(typeof payload.results[0]?.sip_timestamp, "string");
  });

  it("returns MISSING_SEC_USER_AGENT when SEC user agent is absent", async () => {
    const result = await fetchSecFilingsPayload("AAPL", {
      getEnv: () => undefined,
      fetchFn: async () => jsonResponse(200, {}),
    });

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "MISSING_SEC_USER_AGENT");
    assert.deepEqual(result.payload, { filings: [] });
  });

  it("normalizes EODHD insider fetch ticker to AAPL-compatible code", async () => {
    let requestedUrl = "";
    const result = await fetchEodhdInsiderActivityPayload("aapl", {
      getEnv: (key) => (key === "EODHD_API_KEY" ? "eod-key" : undefined),
      fetchFn: async (url) => {
        requestedUrl = String(url);
        return jsonResponse(200, [
          {
            code: "AAPL.US",
            ownerName: "Jane Doe",
            transactionDate: "2026-05-23",
            transactionCode: "P",
            securitiesTransacted: 5000,
            transactionPrice: 190,
          },
        ]);
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.ticker, "AAPL");
    assert.match(requestedUrl, /code=AAPL\.US/);
    const payload = result.payload as { data: unknown[] };
    assert.equal(payload.data.length, 1);
  });

  it("does not expose API keys in sanitized fetch errors", async () => {
    const result = await fetchPolygonDarkPoolPayload("AAPL", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "super-secret-poly-key" : undefined),
      fetchFn: async () => jsonResponse(500, { error: "super-secret-poly-key leaked" }),
    });

    assert.equal(result.ok, false);
    const message = sanitizeFetchErrorMessage("super-secret-poly-key leaked in apiKey=super-secret-poly-key", {
      getEnv: (key) => (key === "POLYGON_API_KEY" ? "super-secret-poly-key" : undefined),
    });
    assert.ok(!message.includes("super-secret-poly-key"));
    assert.match(redactSecretsFromText("apiKey=abc123", ["abc123"]), /\[REDACTED\]/);
  });
});

describe("marketSignals provider-fetch-enqueue route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let authToken = "";
  const oldSecret = process.env.JWT_SECRET;
  const enqueued: Array<{ provider: string; payload: unknown; requestedByUserId?: string }> = [];

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: "user-1", email: "user@example.com" });
    enqueued.length = 0;

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
        enqueueProviderPayload: async (input) => {
          enqueued.push(input);
          return {
            queued: true,
            jobId: buildMarketSignalsJobId("POLYGON_DARK_POOL", 1_700_000_000_333),
            provider: "POLYGON_DARK_POOL",
          };
        },
        fetchAndEnqueueMarketSignal: async (input) => {
          const ticker = normalizeFetchTicker(input.ticker);
          if (!ticker) {
            return {
              queued: false,
              provider: "POLYGON_DARK_POOL",
              ticker: input.ticker,
              fetchOk: false,
              errorCode: "INVALID_TICKER",
            };
          }

          enqueued.push({
            provider: input.provider,
            payload: {
              results: [
                {
                  ticker,
                  price: 190,
                  size: 300_000,
                  exchange: "DARK",
                  sip_timestamp: "2026-05-23T15:45:00.000Z",
                },
              ],
            },
            requestedByUserId: input.requestedByUserId,
          });

          return {
            queued: true,
            provider: "POLYGON_DARK_POOL",
            ticker,
            fetchOk: true,
            jobId: buildMarketSignalsJobId("POLYGON_DARK_POOL", 1_700_000_000_444),
          };
        },
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "user-1",
            email: "user@example.com",
          };
          next();
        },
        requireAdminOrInternalMiddleware: (_req, _res, next) => next(),
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

  it("returns 400 for invalid ticker", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/provider-fetch-enqueue`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "POLYGON_DARK_POOL",
        ticker: "bad ticker!",
      }),
    });

    assert.equal(res.status, 400);
    assert.match((await res.json() as { error: string }).error, /ticker/i);
  });

  it("returns 202 and enqueues fetched payload through queue helper", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/provider-fetch-enqueue`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "POLYGON_DARK_POOL",
        ticker: "AAPL",
        reason: "manual fetch test",
      }),
    });

    assert.equal(res.status, 202);
    const body = (await res.json()) as {
      queued: boolean;
      provider: string;
      ticker: string;
      fetchOk: boolean;
      jobId?: string;
    };
    assert.equal(body.queued, true);
    assert.equal(body.fetchOk, true);
    assert.equal(body.provider, "POLYGON_DARK_POOL");
    assert.equal(body.ticker, "AAPL");
    assert.ok(body.jobId);
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0]?.requestedByUserId, "user-1");
    const payload = enqueued[0]?.payload as { results: Array<{ ticker: string }> };
    assert.equal(payload.results[0]?.ticker, "AAPL");
  });
});

describe("fetchAndEnqueueMarketSignal", () => {
  it("enqueues empty payload when API key is missing", async () => {
    const enqueuedPayloads: unknown[] = [];
    const result = await fetchAndEnqueueMarketSignal(
      {
        provider: "POLYGON_DARK_POOL",
        ticker: "AAPL",
        requestedByUserId: "user-1",
      },
      {
        fetchProviderPayload: async () => ({
          ok: false,
          provider: "POLYGON_DARK_POOL",
          ticker: "AAPL",
          payload: { results: [] },
          errorCode: "MISSING_API_KEY",
        }),
        enqueueProviderPayload: async (input) => {
          enqueuedPayloads.push(input.payload);
          return {
            queued: true,
            jobId: "job-missing-key",
            provider: "POLYGON_DARK_POOL",
          };
        },
      },
    );

    assert.equal(result.queued, true);
    assert.equal(result.fetchOk, false);
    assert.equal(result.errorCode, "MISSING_API_KEY");
    assert.deepEqual(enqueuedPayloads[0], { results: [] });
  });
});
