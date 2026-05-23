import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { signAuthToken } from "../auth/authJwt";
import type { AuthenticatedRequest } from "../auth/authMiddleware";
import {
  createMarketSignalIngestionService,
  InvalidMarketSignalProviderError,
} from "./marketSignals.ingestion";
import type { MarketSignalIngestionRepository } from "./marketSignals.ingestion";
import { createMarketSignalsRouter } from "./marketSignals.routes";
import type {
  MarketSignalIngestInput,
  MarketSignalIngestResponse,
  MarketSignalProvider,
} from "./marketSignals.types";

class FakeMarketSignalRepository implements MarketSignalIngestionRepository {
  readonly saved: MarketSignalIngestInput[] = [];
  private counter = 0;

  async ingestSignal(input: MarketSignalIngestInput): Promise<MarketSignalIngestResponse> {
    this.saved.push(input);
    this.counter += 1;
    const timestamp = "2026-05-24T12:00:00.000Z";
    return {
      saved: true,
      signal: {
        id: `sig-${this.counter}`,
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
  }
}

function createIngestionService(
  repo: FakeMarketSignalRepository,
  adapters?: Partial<Record<MarketSignalProvider, (payload: unknown) => MarketSignalIngestInput[]>>,
) {
  return createMarketSignalIngestionService({
    marketSignalService: repo,
    adapters,
  });
}

describe("marketSignals.ingestion", () => {
  it("dispatches POLYGON_OPTIONS_FLOW to options adapter and saves parsed item", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    const result = await ingestion.ingestProviderPayload("POLYGON_OPTIONS_FLOW", {
      results: [
        {
          ticker: "AAPL",
          contract_type: "call",
          premium: 5_200_000,
          volume: 12000,
          open_interest: 1800,
          trade_timestamp: "2026-05-23T14:30:00.000Z",
        },
      ],
    });

    assert.equal(result.provider, "POLYGON_OPTIONS_FLOW");
    assert.equal(result.parsedCount, 1);
    assert.equal(result.savedCount, 1);
    assert.equal(result.rejectedCount, 0);
    assert.equal(repo.saved.length, 1);
    assert.equal(repo.saved[0]?.signalType, "OPTIONS_FLOW");
    assert.equal(repo.saved[0]?.ticker, "AAPL");
    assert.equal(result.signals[0]?.signalType, "OPTIONS_FLOW");
  });

  it("dispatches POLYGON_DARK_POOL and ignores below-threshold dark pool item", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    const result = await ingestion.ingestProviderPayload("POLYGON_DARK_POOL", {
      results: [
        {
          ticker: "AAPL",
          price: 190.12,
          size: 100_000,
          exchange: "DARK",
          sip_timestamp: "2026-05-23T15:45:00.000Z",
        },
      ],
    });

    assert.equal(result.parsedCount, 0);
    assert.equal(result.savedCount, 0);
    assert.equal(result.rejectedCount, 0);
    assert.equal(repo.saved.length, 0);
  });

  it("saves SEC_FILINGS 10-Q signal", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    const result = await ingestion.ingestProviderPayload("SEC_FILINGS", {
      filings: [
        {
          ticker: "AAPL",
          form: "10-Q",
          accessionNumber: "0000320193-26-000010",
          filedAt: "2026-05-23T12:00:00.000Z",
          description: "Quarterly report",
        },
      ],
    });

    assert.equal(result.savedCount, 1);
    assert.equal(repo.saved[0]?.signalType, "SEC_FILING");
    assert.equal(repo.saved[0]?.confidenceScore, 65);
    assert.match(repo.saved[0]?.title ?? "", /10-Q/);
  });

  it("saves EODHD_INSIDER_ACTIVITY insider purchase", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    const result = await ingestion.ingestProviderPayload("EODHD_INSIDER_ACTIVITY", {
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "P",
          securitiesTransacted: 5000,
          transactionPrice: 190,
        },
      ],
    });

    assert.equal(result.savedCount, 1);
    assert.equal(repo.saved[0]?.ticker, "AAPL");
    assert.equal(repo.saved[0]?.signalType, "INSIDER_ACTIVITY");
    assert.match(repo.saved[0]?.title ?? "", /Jane Doe/);
  });

  it("returns parsedCount 0 and savedCount 0 for malformed payload", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    const result = await ingestion.ingestProviderPayload("POLYGON_OPTIONS_FLOW", "not-an-object");

    assert.equal(result.parsedCount, 0);
    assert.equal(result.savedCount, 0);
    assert.equal(result.rejectedCount, 0);
    assert.equal(repo.saved.length, 0);
  });

  it("dedupes duplicate parsed items in the same payload", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);
    const duplicateItem = {
      ticker: "AAPL",
      contract_type: "call",
      premium: 5_200_000,
      volume: 12000,
      open_interest: 1800,
      trade_timestamp: "2026-05-23T14:30:00.000Z",
    };

    const result = await ingestion.ingestProviderPayload("POLYGON_OPTIONS_FLOW", {
      results: [duplicateItem, duplicateItem],
    });

    assert.equal(result.parsedCount, 2);
    assert.equal(result.savedCount, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(repo.saved.length, 1);
  });

  it("throws for invalid provider", () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo);

    assert.throws(
      () => ingestion.parseProviderPayload("UNKNOWN_PROVIDER" as MarketSignalProvider, {}),
      InvalidMarketSignalProviderError,
    );
  });

  it("rejects invalid parsed signal but still saves valid signals", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo, {
      POLYGON_OPTIONS_FLOW: () => [
        {
          ticker: "AAPL",
          signalType: "OPTIONS_FLOW",
          source: "polygon-options-flow",
          confidenceScore: 80,
          title: "AAPL valid options flow",
          eventTime: "2026-05-23T14:30:00.000Z",
        },
        {
          ticker: "AAPL",
          signalType: "OPTIONS_FLOW",
          source: "polygon-options-flow",
          confidenceScore: 150,
          title: "AAPL invalid confidence",
          eventTime: "2026-05-23T14:30:00.000Z",
        },
      ],
    });

    const result = await ingestion.ingestProviderPayload("POLYGON_OPTIONS_FLOW", {});

    assert.equal(result.parsedCount, 2);
    assert.equal(result.savedCount, 1);
    assert.equal(result.rejectedCount, 1);
    assert.equal(repo.saved.length, 1);
    assert.equal(repo.saved[0]?.title, "AAPL valid options flow");
  });

  it("calculates rejectedCount as parsedCount minus savedCount", async () => {
    const repo = new FakeMarketSignalRepository();
    const ingestion = createIngestionService(repo, {
      SEC_FILINGS: () => [
        {
          ticker: "AAPL",
          signalType: "SEC_FILING",
          source: "sec-filing",
          confidenceScore: 65,
          title: "AAPL SEC filing: 10-Q",
          eventTime: "2026-05-23T12:00:00.000Z",
        },
        {
          ticker: "AAPL",
          signalType: "SEC_FILING",
          source: "sec-filing",
          confidenceScore: 65,
          title: "AAPL SEC filing: 10-Q",
          eventTime: "2026-05-23T12:00:00.000Z",
        },
        {
          ticker: "",
          signalType: "SEC_FILING",
          source: "sec-filing",
          confidenceScore: 65,
          title: "Missing ticker filing",
        },
      ],
    });

    const result = await ingestion.ingestProviderPayload("SEC_FILINGS", {});

    assert.equal(result.parsedCount, 3);
    assert.equal(result.savedCount, 1);
    assert.equal(result.rejectedCount, 2);
  });
});

describe("marketSignals provider-ingest route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let authToken = "";
  const oldSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    authToken = signAuthToken({ sub: "user-1", email: "user@example.com" });

    const repo = new FakeMarketSignalRepository();
    const ingestionService = createIngestionService(repo);
    const app = express();
    app.use(express.json());
    app.use(
      createMarketSignalsRouter({
        service: {
          listSignals: async () => {
            throw new Error("not used");
          },
          ingestSignal: (input: MarketSignalIngestInput) => repo.ingestSignal(input),
        } as never,
        ingestionService,
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

  it("validates provider-ingest request body", async () => {
    const missingProvider = await fetch(`${baseUrl}/api/v1/market-signals/provider-ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ payload: {} }),
    });
    assert.equal(missingProvider.status, 400);
    assert.match((await missingProvider.json() as { error: string }).error, /provider/i);

    const missingPayload = await fetch(`${baseUrl}/api/v1/market-signals/provider-ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ provider: "POLYGON_OPTIONS_FLOW" }),
    });
    assert.equal(missingPayload.status, 400);
    assert.match((await missingPayload.json() as { error: string }).error, /payload/i);

    const success = await fetch(`${baseUrl}/api/v1/market-signals/provider-ingest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "POLYGON_OPTIONS_FLOW",
        payload: {
          results: [
            {
              ticker: "MSFT",
              contract_type: "put",
              premium: 2_000_000,
              volume: 6000,
              open_interest: 2000,
              trade_timestamp: "2026-05-23T14:30:00.000Z",
            },
          ],
        },
      }),
    });
    assert.equal(success.status, 201);
    const body = (await success.json()) as {
      provider: string;
      parsedCount: number;
      savedCount: number;
      rejectedCount: number;
      signals: Array<{ ticker: string }>;
    };
    assert.equal(body.provider, "POLYGON_OPTIONS_FLOW");
    assert.equal(body.parsedCount, 1);
    assert.equal(body.savedCount, 1);
    assert.equal(body.rejectedCount, 0);
    assert.equal(body.signals[0]?.ticker, "MSFT");
  });
});
