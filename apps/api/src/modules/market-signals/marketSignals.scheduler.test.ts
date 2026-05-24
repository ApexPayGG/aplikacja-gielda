import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Job } from "bullmq";
import { InvalidMarketSignalProviderError } from "./marketSignals.ingestion";
import type { MarketSignalFetchResult, MarketSignalProvider } from "./marketSignals.types";
import {
  createMarketSignalsWorkerHandler,
  MARKET_SIGNALS_JOB_NAMES,
  type FetchProviderAndIngestJobData,
} from "./marketSignals.queue";
import {
  createMarketSignalsScheduledBatchRunner,
  DEFAULT_MARKET_SIGNALS_SCHEDULER_INTERVAL_MINUTES,
  DEFAULT_MARKET_SIGNALS_SCHEDULER_PROVIDERS,
  DEFAULT_MARKET_SIGNALS_SCHEDULER_TICKERS,
  enqueueScheduledMarketSignalFetchJobs,
  isMarketSignalsSchedulerEnabled,
  parseMarketSignalsSchedulerConfig,
  registerMarketSignalsScheduler,
  resolveMarketSignalsSchedulerPairs,
  SCHEDULED_MARKET_SIGNALS_REASON,
} from "./marketSignals.scheduler";

type LogEntry = { event: string; meta: Record<string, unknown> };

function createTestLogger(): { logger: { info: (event: string, meta?: Record<string, unknown>) => void }; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    logger: {
      info: (event, meta = {}) => {
        entries.push({ event, meta });
      },
    },
  };
}

describe("marketSignals.scheduler", () => {
  it("returns no jobs when scheduler is disabled and logs disabled", async () => {
    const { logger, entries } = createTestLogger();
    const fetchCalls: unknown[] = [];

    const result = await registerMarketSignalsScheduler({
      getEnv: (key) => (key === "MARKET_SIGNALS_SCHEDULER_ENABLED" ? "false" : undefined),
      logger,
      queue: {
        add: async () => {
          throw new Error("queue.add should not be called when disabled");
        },
      },
    });

    const enqueued = await enqueueScheduledMarketSignalFetchJobs(
      parseMarketSignalsSchedulerConfig((key) =>
        key === "MARKET_SIGNALS_SCHEDULER_ENABLED" ? "false" : undefined,
      ),
      {
        logger,
        enqueueFetch: async () => {
          fetchCalls.push("enqueue");
          return { queued: true, jobId: "job-1", provider: "POLYGON_DARK_POOL", ticker: "AAPL" };
        },
      },
    );

    assert.equal(result.enabled, false);
    assert.equal(result.scheduled, false);
    assert.equal(enqueued.enqueued, 0);
    assert.equal(fetchCalls.length, 0);
    assert.ok(entries.some((entry) => entry.event === "market_signals_scheduler_disabled"));
    assert.equal(isMarketSignalsSchedulerEnabled(() => "false"), false);
    assert.equal(isMarketSignalsSchedulerEnabled(() => "true"), true);
    assert.equal(isMarketSignalsSchedulerEnabled(() => undefined), false);
  });

  it("parses tickers and providers when enabled", () => {
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "aapl,msft";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,SEC_FILINGS";
      return undefined;
    });

    assert.equal(config.enabled, true);
    assert.deepEqual(config.tickers, ["AAPL", "MSFT"]);
    assert.deepEqual(config.providers, ["POLYGON_DARK_POOL", "SEC_FILINGS"]);
  });

  it("skips invalid tickers", () => {
    const { logger, entries } = createTestLogger();
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL,bad ticker!,MSFT";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL";
      return undefined;
    });

    const pairs = resolveMarketSignalsSchedulerPairs(config, {
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL,bad ticker!,MSFT";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL";
        return undefined;
      },
      logger,
    });

    assert.deepEqual(
      pairs.map((pair) => pair.ticker),
      ["AAPL", "MSFT"],
    );
    assert.ok(entries.some((entry) => entry.event === "market_signals_scheduler_invalid_ticker_skipped"));
  });

  it("skips invalid providers", () => {
    const { logger, entries } = createTestLogger();
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,BAD_PROVIDER";
      return undefined;
    });

    const pairs = resolveMarketSignalsSchedulerPairs(config, {
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,BAD_PROVIDER";
        return undefined;
      },
      logger,
    });

    assert.deepEqual(pairs.map((pair) => pair.provider), ["POLYGON_DARK_POOL"]);
    assert.ok(entries.some((entry) => entry.event === "market_signals_scheduler_invalid_provider_skipped"));
  });

  it("enforces max tickers cap", () => {
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_MAX_TICKERS") return "2";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL,MSFT,NVDA,AMD";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL";
      return undefined;
    });

    assert.equal(config.tickers.length, 2);
    assert.deepEqual(config.tickers, ["AAPL", "MSFT"]);
  });

  it("uses default tickers and providers when enabled but env values are missing", () => {
    const config = parseMarketSignalsSchedulerConfig((key) =>
      key === "MARKET_SIGNALS_SCHEDULER_ENABLED" ? "true" : undefined,
    );

    assert.deepEqual(config.tickers, [...DEFAULT_MARKET_SIGNALS_SCHEDULER_TICKERS]);
    assert.deepEqual(config.providers, [...DEFAULT_MARKET_SIGNALS_SCHEDULER_PROVIDERS]);
  });

  it("defaults interval to 240 minutes", () => {
    const config = parseMarketSignalsSchedulerConfig((key) =>
      key === "MARKET_SIGNALS_SCHEDULER_ENABLED" ? "true" : undefined,
    );
    assert.equal(config.intervalMinutes, DEFAULT_MARKET_SIGNALS_SCHEDULER_INTERVAL_MINUTES);
    assert.equal(config.intervalMinutes, 240);
  });

  it("enqueues fetch jobs for valid ticker/provider pairs", async () => {
    const { logger, entries } = createTestLogger();
    const enqueuedJobs: Array<{ provider: MarketSignalProvider; ticker: string; reason?: string }> = [];
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,SEC_FILINGS";
      return undefined;
    });

    const result = await enqueueScheduledMarketSignalFetchJobs(config, {
      logger,
      now: () => 1_700_000_000_000,
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,SEC_FILINGS";
        return undefined;
      },
      enqueueFetch: async (input) => {
        enqueuedJobs.push({
          provider: input.provider as MarketSignalProvider,
          ticker: input.ticker,
          reason: input.reason,
        });
        return {
          queued: true,
          jobId: `job-${input.provider}-${input.ticker}`,
          provider: input.provider as MarketSignalProvider,
          ticker: input.ticker,
        };
      },
    });

    assert.equal(result.enqueued, 2);
    assert.equal(enqueuedJobs.length, 2);
    assert.equal(enqueuedJobs[0]?.reason, SCHEDULED_MARKET_SIGNALS_REASON);
    assert.ok(entries.some((entry) => entry.event === "market_signals_scheduler_job_enqueued"));
  });

  it("does not call external fetch during scheduler registration", async () => {
    const fetchCalls: unknown[] = [];
    let repeatEvery: number | undefined;

    const result = await registerMarketSignalsScheduler({
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL";
        return undefined;
      },
      queue: {
        add: async (_name, _data, options) => {
          repeatEvery = options?.repeat?.every;
          return { id: "repeat-job" };
        },
      },
    });

    assert.equal(result.enabled, true);
    assert.equal(result.scheduled, true);
    assert.equal(fetchCalls.length, 0);
    assert.equal(repeatEvery, 240 * 60 * 1000);
  });

  it("worker handles fetch-provider-and-ingest with mocked fetcher and ingestion", async () => {
    const fetchCalls: Array<{ provider: MarketSignalProvider; ticker: string }> = [];
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: {
        parseProviderPayload: () => [],
        ingestProviderPayload: async (provider, payload) => {
          assert.deepEqual(payload, { results: [{ ticker: "AAPL" }] });
          return {
            provider,
            parsedCount: 1,
            savedCount: 1,
            rejectedCount: 0,
            signals: [],
          };
        },
      },
      fetchProviderPayload: async (providerInput, ticker): Promise<MarketSignalFetchResult> => {
        const provider = providerInput as MarketSignalProvider;
        fetchCalls.push({ provider, ticker });
        return {
          ok: true,
          provider,
          ticker,
          payload: { results: [{ ticker: "AAPL" }] },
        };
      },
    });

    const result = await handler({
      id: "job-fetch-1",
      name: MARKET_SIGNALS_JOB_NAMES.FETCH_PROVIDER_AND_INGEST,
      data: {
        provider: "POLYGON_DARK_POOL",
        ticker: "AAPL",
        reason: SCHEDULED_MARKET_SIGNALS_REASON,
      },
    } as Job<FetchProviderAndIngestJobData>);

    assert.deepEqual(fetchCalls, [{ provider: "POLYGON_DARK_POOL", ticker: "AAPL" }]);
    assert.equal((result as { savedCount: number }).savedCount, 1);
    assert.equal((result as { fetchOk: boolean }).fetchOk, true);
  });

  it("scheduled batch runner enqueues without calling fetchProviderPayload directly", async () => {
    const fetchCalls: unknown[] = [];
    const runner = createMarketSignalsScheduledBatchRunner({
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "AAPL";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL";
        return undefined;
      },
      enqueueScheduledJobs: async () => ({ enqueued: 1 }),
    });

    const result = await runner();
    assert.equal(result.enqueued, 1);
    assert.equal(fetchCalls.length, 0);
  });

  it("worker fetch job skips ingest on HTTP_ERROR fetch result", async () => {
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: {
        parseProviderPayload: () => [],
        ingestProviderPayload: async () => {
          throw new Error("ingest should not run");
        },
      },
      fetchProviderPayload: async (providerInput, ticker): Promise<MarketSignalFetchResult> => {
        const provider = providerInput as MarketSignalProvider;
        return {
          ok: false,
          provider,
          ticker,
          payload: { results: [] },
          errorCode: "HTTP_ERROR",
          statusCode: 500,
        };
      },
    });

    const result = await handler({
      id: "job-fetch-2",
      name: MARKET_SIGNALS_JOB_NAMES.FETCH_PROVIDER_AND_INGEST,
      data: {
        provider: "POLYGON_DARK_POOL",
        ticker: "AAPL",
      },
    } as Job<FetchProviderAndIngestJobData>);

    assert.equal((result as { savedCount: number }).savedCount, 0);
    assert.equal((result as { skippedIngest: boolean }).skippedIngest, true);
  });

  it("worker rejects invalid provider in fetch job", async () => {
    const handler = createMarketSignalsWorkerHandler({
      ingestionService: {
        parseProviderPayload: () => [],
        ingestProviderPayload: async () => {
          throw new Error("should not run");
        },
      },
    });

    await assert.rejects(
      () =>
        handler({
          id: "job-fetch-3",
          name: MARKET_SIGNALS_JOB_NAMES.FETCH_PROVIDER_AND_INGEST,
          data: {
            provider: "BAD_PROVIDER" as MarketSignalProvider,
            ticker: "AAPL",
          },
        } as Job<FetchProviderAndIngestJobData>),
      InvalidMarketSignalProviderError,
    );
  });
});
