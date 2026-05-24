import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import type { Job } from "bullmq";
import { signAuthToken } from "../auth/authJwt";
import type { AuthenticatedRequest } from "../auth/authMiddleware";
import { createMarketSignalIngestionService, InvalidMarketSignalProviderError } from "./marketSignals.ingestion";
import type {
  MarketSignalIngestInput,
  MarketSignalIngestResponse,
  MarketSignalProvider,
} from "./marketSignals.types";
import {
  buildMarketSignalsJobId,
  createMarketSignalsWorkerHandler,
  enqueueProviderPayload,
  MARKET_SIGNALS_JOB_NAMES,
  type IngestProviderPayloadJobData,
} from "./marketSignals.queue";
import { createMarketSignalsRouter } from "./marketSignals.routes";

describe("marketSignals.queue", () => {
  it("builds jobId without colon and includes provider", () => {
    const jobId = buildMarketSignalsJobId("POLYGON_DARK_POOL", 1_700_000_000_000);
    assert.ok(!jobId.includes(":"));
    assert.match(jobId, /POLYGON_DARK_POOL/);
    assert.equal(jobId, "market-signals__POLYGON_DARK_POOL__1700000000000");
  });

  it("accepts normalized provider on enqueue", async () => {
    const added: Array<{ name: string; data: IngestProviderPayloadJobData; jobId: string }> = [];
    const result = await enqueueProviderPayload(
      {
        provider: "polygon_options_flow",
        payload: { results: [] },
        requestedByUserId: "user-1",
        reason: "manual test",
      },
      {
        now: () => 1_700_000_000_111,
        queue: {
          add: async (name, data, options) => {
            added.push({ name, data, jobId: options.jobId });
            return { id: options.jobId };
          },
        },
      },
    );

    assert.equal(result.queued, true);
    assert.equal(result.provider, "POLYGON_OPTIONS_FLOW");
    assert.equal(result.jobId, "market-signals__POLYGON_OPTIONS_FLOW__1700000000111");
    assert.equal(added.length, 1);
    assert.equal(added[0]?.name, MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD);
    assert.equal(added[0]?.data.provider, "POLYGON_OPTIONS_FLOW");
    assert.equal(added[0]?.data.requestedByUserId, "user-1");
    assert.equal(added[0]?.data.reason, "manual test");
    assert.ok(!added[0]?.jobId.includes(":"));
  });

  it("rejects invalid provider before enqueue", async () => {
    await assert.rejects(
      () =>
        enqueueProviderPayload(
          { provider: "UNKNOWN", payload: {} },
          {
            queue: {
              add: async () => ({ id: "unused" }),
            },
          },
        ),
      InvalidMarketSignalProviderError,
    );
  });
});

describe("marketSignals.worker handler", () => {
  it("calls ingestion service with provider and payload and returns result", async () => {
    const calls: Array<{ provider: MarketSignalProvider; payload: unknown }> = [];
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: {
        parseProviderPayload: () => [],
        ingestProviderPayload: async (provider, payload) => {
          calls.push({ provider, payload });
          return {
            provider,
            parsedCount: 1,
            savedCount: 1,
            rejectedCount: 0,
            signals: [],
          };
        },
      },
    });

    const payload = {
      results: [
        {
          ticker: "AAPL",
          price: 190,
          size: 300_000,
          exchange: "DARK",
          sip_timestamp: "2026-05-23T15:45:00.000Z",
        },
      ],
    };

    const result = await handler({
      id: "job-1",
      name: MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD,
      data: {
        provider: "POLYGON_DARK_POOL",
        payload,
      },
    } as Job<IngestProviderPayloadJobData>);

    assert.deepEqual(calls, [{ provider: "POLYGON_DARK_POOL", payload }]);
    assert.equal(result.savedCount, 1);
    assert.equal(result.provider, "POLYGON_DARK_POOL");
  });

  it("returns savedCount 0 for malformed payload through ingestion path", async () => {
    const repo = {
      saved: [] as MarketSignalIngestInput[],
      async ingestSignal(input: MarketSignalIngestInput): Promise<MarketSignalIngestResponse> {
        this.saved.push(input);
        const timestamp = "2026-05-24T12:00:00.000Z";
        return {
          saved: true,
          signal: {
            id: "sig-1",
            ticker: input.ticker,
            signalType: input.signalType,
            source: input.source,
            confidenceScore: input.confidenceScore,
            title: input.title,
            summary: input.summary ?? null,
            rawPayload: input.rawPayload ?? null,
            eventTime: input.eventTime ?? timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        };
      },
    };
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: createMarketSignalIngestionService({ marketSignalService: repo }),
    });

    const result = await handler({
      id: "job-2",
      name: MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD,
      data: {
        provider: "POLYGON_OPTIONS_FLOW",
        payload: "malformed",
      },
    } as Job<IngestProviderPayloadJobData>);

    assert.equal(result.savedCount, 0);
    assert.equal(result.parsedCount, 0);
    assert.equal(repo.saved.length, 0);
  });

  it("fails cleanly for invalid provider in job data", async () => {
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: {
        parseProviderPayload: () => [],
        ingestProviderPayload: async () => {
          throw new Error("should not be called");
        },
      },
    });

    await assert.rejects(
      () =>
        handler({
          id: "job-3",
          name: MARKET_SIGNALS_JOB_NAMES.INGEST_PROVIDER_PAYLOAD,
          data: {
            provider: "BAD_PROVIDER" as MarketSignalProvider,
            payload: {},
          },
        } as Job<IngestProviderPayloadJobData>),
      InvalidMarketSignalProviderError,
    );
  });
});

describe("marketSignals provider-enqueue route", () => {
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
            jobId: buildMarketSignalsJobId("POLYGON_DARK_POOL", 1_700_000_000_222),
            provider: "POLYGON_DARK_POOL",
          };
        },
        requireAuthMiddleware: (req: Request, _res, next) => {
          (req as AuthenticatedRequest).auth = {
            userId: "user-1",
            email: "user@example.com",
          };
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
    process.env.JWT_SECRET = oldSecret;
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("returns 202 with queued true when enqueue succeeds", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/provider-enqueue`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "POLYGON_DARK_POOL",
        payload: {
          results: [
            {
              ticker: "AAPL",
              price: 190,
              size: 300_000,
              exchange: "DARK",
              sip_timestamp: "2026-05-23T15:45:00.000Z",
            },
          ],
        },
        reason: "smoke-test",
      }),
    });

    assert.equal(res.status, 202);
    const body = (await res.json()) as {
      queued: boolean;
      jobId: string;
      provider: string;
    };
    assert.equal(body.queued, true);
    assert.equal(body.provider, "POLYGON_DARK_POOL");
    assert.ok(!body.jobId.includes(":"));
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0]?.requestedByUserId, "user-1");
    assert.equal(enqueued[0]?.provider, "POLYGON_DARK_POOL");
  });
});
