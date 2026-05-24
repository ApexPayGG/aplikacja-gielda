import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Request } from "express";
import { ADMIN_OR_INTERNAL_REQUIRED_RESPONSE } from "../../middleware/requireAdminOrInternal";
import type { AuthenticatedRequest } from "../auth/authMiddleware";
import {
  buildMarketSignalsOpsHealth,
  buildMarketSignalsOpsWarnings,
  buildProviderReadiness,
  loadMarketSignalsDatabaseStats,
} from "./marketSignals.ops";
import { createMarketSignalsRouter } from "./marketSignals.routes";
import { parseMarketSignalsSchedulerConfig } from "./marketSignals.scheduler";
import type { MarketSignalType } from "./marketSignals.types";

const FIXED_NOW = new Date("2026-05-24T12:00:00.000Z");

function createMockDb(input: {
  total24h?: number;
  total7d?: number;
  rows24h?: Array<{ signalType: MarketSignalType; source: string }>;
  latestCreatedAt?: Date | null;
  fail?: boolean;
}) {
  return {
    marketSignal: {
      count: async ({ where }: { where: { createdAt: { gte: Date } } }) => {
        if (input.fail) throw new Error("db count failed");
        const sinceMs = where.createdAt.gte.getTime();
        const dayMs = 86_400_000;
        if (sinceMs >= FIXED_NOW.getTime() - dayMs) {
          return input.total24h ?? input.rows24h?.length ?? 0;
        }
        return input.total7d ?? input.total24h ?? input.rows24h?.length ?? 0;
      },
      findMany: async () => {
        if (input.fail) throw new Error("db findMany failed");
        return input.rows24h ?? [];
      },
      findFirst: async () => {
        if (input.fail) throw new Error("db findFirst failed");
        if (input.latestCreatedAt === null || input.latestCreatedAt === undefined) return null;
        return { createdAt: input.latestCreatedAt };
      },
    },
  };
}

describe("marketSignals.ops", () => {
  it("detects missing POLYGON_API_KEY when env value is empty", async () => {
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "POLYGON_API_KEY") return "";
        if (key === "EODHD_API_KEY") return "eod-key";
        if (key === "SEC_USER_AGENT") return "StockAI/1.0 contact@example.com";
        return undefined;
      },
      db: createMockDb({ total24h: 1, rows24h: [{ signalType: "DARK_POOL", source: "polygon" }] }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 1,
        failed: 0,
      }),
    });

    assert.equal(health.providerReadiness.polygon.apiKeyConfigured, false);
    assert.equal(health.providerReadiness.polygon.usable, false);
    assert.ok(health.warnings.includes("POLYGON_API_KEY is missing or empty."));
  });

  it("detects configured EODHD_API_KEY", async () => {
    const readiness = buildProviderReadiness((key) => {
      if (key === "EODHD_API_KEY") return "eod-secret";
      return undefined;
    });

    assert.equal(readiness.eodhd.apiKeyConfigured, true);
    assert.equal(readiness.eodhd.usable, true);
  });

  it("detects missing SEC_USER_AGENT", async () => {
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "POLYGON_API_KEY") return "poly-key";
        if (key === "EODHD_API_KEY") return "eod-key";
        return undefined;
      },
      db: createMockDb({ total24h: 2, rows24h: [] }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    });

    assert.equal(health.providerReadiness.sec.userAgentConfigured, false);
    assert.equal(health.providerReadiness.sec.usable, false);
    assert.ok(health.warnings.includes("SEC_USER_AGENT is missing; SEC fetcher is disabled."));
  });

  it("adds scheduler disabled warning when env flag is not true", async () => {
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "POLYGON_API_KEY") return "poly-key";
        if (key === "SEC_USER_AGENT") return "StockAI/1.0";
        if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "false";
        return undefined;
      },
      db: createMockDb({ total24h: 1, rows24h: [{ signalType: "SEC_FILING", source: "sec" }] }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    });

    assert.equal(health.scheduler.enabled, false);
    assert.ok(health.warnings.includes("MarketSignals scheduler is disabled."));
  });

  it("parses scheduler tickers and providers when enabled", async () => {
    const config = parseMarketSignalsSchedulerConfig((key) => {
      if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
      if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "aapl,msft";
      if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,SEC_FILINGS";
      return undefined;
    });

    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "MARKET_SIGNALS_SCHEDULER_ENABLED") return "true";
        if (key === "MARKET_SIGNALS_SCHEDULER_TICKERS") return "aapl,msft";
        if (key === "MARKET_SIGNALS_SCHEDULER_PROVIDERS") return "POLYGON_DARK_POOL,SEC_FILINGS";
        if (key === "POLYGON_API_KEY") return "poly-key";
        if (key === "SEC_USER_AGENT") return "StockAI/1.0";
        return undefined;
      },
      parseSchedulerConfig: () => config,
      db: createMockDb({ total24h: 3, rows24h: [] }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    });

    assert.equal(health.scheduler.enabled, true);
    assert.deepEqual(health.scheduler.configuredTickers, ["AAPL", "MSFT"]);
    assert.deepEqual(health.scheduler.configuredProviders, ["POLYGON_DARK_POOL", "SEC_FILINGS"]);
  });

  it("adds warning on queue failure and does not crash", async () => {
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "POLYGON_API_KEY") return "poly-key";
        if (key === "SEC_USER_AGENT") return "StockAI/1.0";
        return undefined;
      },
      db: createMockDb({ total24h: 1, rows24h: [{ signalType: "DARK_POOL", source: "polygon" }] }),
      getQueueJobCounts: async () => {
        throw new Error("redis unavailable");
      },
    });

    assert.equal(health.queue.waiting, 0);
    assert.equal(health.queue.failed, 0);
    assert.equal(health.queue.name, "market-signals-ingestion-queue");
    assert.ok(health.warnings.includes("Market signals queue stats unavailable."));
    assert.equal(health.ok, true);
  });

  it("summarizes DB stats into byType24h and bySource24h", async () => {
    const stats = await loadMarketSignalsDatabaseStats(
      createMockDb({
        total24h: 3,
        total7d: 5,
        rows24h: [
          { signalType: "DARK_POOL", source: "polygon" },
          { signalType: "DARK_POOL", source: "polygon" },
          { signalType: "INSIDER_ACTIVITY", source: "eodhd" },
        ],
        latestCreatedAt: new Date("2026-05-24T11:30:00.000Z"),
      }),
      FIXED_NOW,
    );

    assert.equal(stats.totalSignals24h, 3);
    assert.equal(stats.totalSignals7d, 5);
    assert.deepEqual(stats.byType24h, {
      DARK_POOL: 2,
      INSIDER_ACTIVITY: 1,
    });
    assert.deepEqual(stats.bySource24h, {
      polygon: 2,
      eodhd: 1,
    });
    assert.equal(stats.latestSignalAt, "2026-05-24T11:30:00.000Z");
  });

  it("returns latestSignalAt null when no records", async () => {
    const stats = await loadMarketSignalsDatabaseStats(
      createMockDb({
        total24h: 0,
        total7d: 0,
        rows24h: [],
        latestCreatedAt: null,
      }),
      FIXED_NOW,
    );

    assert.equal(stats.latestSignalAt, null);
  });

  it("marks ok false when database stats fail", async () => {
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: () => undefined,
      db: createMockDb({ fail: true }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    });

    assert.equal(health.ok, false);
    assert.ok(health.warnings.some((warning) => warning.startsWith("Database stats unavailable:")));
  });

  it("warns when queue has failed jobs", () => {
    const warnings = buildMarketSignalsOpsWarnings({
      scheduler: parseMarketSignalsSchedulerConfig((key) =>
        key === "MARKET_SIGNALS_SCHEDULER_ENABLED" ? "true" : undefined,
      ),
      providerReadiness: buildProviderReadiness(() => "configured"),
      queue: {
        name: "market-signals-ingestion-queue",
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 10,
        failed: 2,
      },
      database: {
        totalSignals24h: 5,
        totalSignals7d: 10,
        byType24h: {},
        bySource24h: {},
        latestSignalAt: FIXED_NOW.toISOString(),
      },
    });

    assert.ok(warnings.includes("Queue has failed jobs."));
  });

  it("does not expose secret values in response", async () => {
    const secret = "super-secret-polygon-key-12345";
    const health = await buildMarketSignalsOpsHealth({
      now: () => FIXED_NOW,
      getEnv: (key) => {
        if (key === "POLYGON_API_KEY") return secret;
        if (key === "EODHD_API_KEY") return "eod-secret";
        if (key === "SEC_USER_AGENT") return "StockAI/1.0";
        return undefined;
      },
      db: createMockDb({ total24h: 1, rows24h: [{ signalType: "DARK_POOL", source: "polygon" }] }),
      getQueueJobCounts: async () => ({
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      }),
    });

    const serialized = JSON.stringify(health);
    assert.ok(!serialized.includes(secret));
    assert.ok(!serialized.includes("eod-secret"));
  });
});

describe("marketSignals ops/health route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let adminGuardCalls = 0;
  const opsPayload = {
    ok: true,
    generatedAt: FIXED_NOW.toISOString(),
    scheduler: {
      enabled: false,
      intervalMinutes: 240,
      maxTickers: 25,
      configuredTickers: [],
      configuredProviders: [],
    },
    providerReadiness: {
      polygon: { apiKeyConfigured: true, usable: true },
      eodhd: { apiKeyConfigured: false, usable: false },
      sec: { userAgentConfigured: true, usable: true },
    },
    queue: {
      name: "market-signals-ingestion-queue" as const,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    },
    database: {
      totalSignals24h: 0,
      totalSignals7d: 0,
      byType24h: {},
      bySource24h: {},
      latestSignalAt: null,
    },
    warnings: ["MarketSignals scheduler is disabled."],
  };

  beforeEach(async () => {
    adminGuardCalls = 0;
    const app = express();
    app.use(express.json());
    app.use(
      createMarketSignalsRouter({
        service: {
          listSignals: async ({ ticker }: { ticker: string }) => ({
            ticker,
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
        getOpsHealth: async () => opsPayload,
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

  it("requires admin/internal guard for ops health endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/ops/health`);
    assert.equal(res.status, 200);
    assert.equal(adminGuardCalls, 1);
    assert.deepEqual(await res.json(), opsPayload);
  });

  it("does not shadow ops/health with ticker route", async () => {
    const res = await fetch(`${baseUrl}/api/v1/market-signals/ops/health`);
    const body = (await res.json()) as { ok?: boolean; ticker?: string };
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.ticker, undefined);
    assert.equal(adminGuardCalls, 1);
  });

  it("rejects ops health without admin/internal access", async () => {
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
        getOpsHealth: async () => opsPayload,
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

    const res = await fetch(`${guardedBaseUrl}/api/v1/market-signals/ops/health`);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
  });
});
