import { prisma as defaultPrisma } from "../../db";
import {
  getMarketSignalsQueue,
  MARKET_SIGNALS_QUEUE_NAME,
} from "./marketSignals.queue";
import {
  parseMarketSignalsSchedulerConfig,
  type MarketSignalsSchedulerConfig,
} from "./marketSignals.scheduler";
import type {
  MarketSignalType,
  MarketSignalsOpsDatabaseStats,
  MarketSignalsOpsHealthResponse,
  MarketSignalsOpsProviderReadiness,
  MarketSignalsOpsQueueStats,
} from "./marketSignals.types";

const MS_PER_DAY = 86_400_000;

export type EnvGetter = (key: string) => string | undefined;

export type MarketSignalsOpsQueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
};

export type MarketSignalsOpsDb = {
  marketSignal: {
    count: (args: { where: { createdAt: { gte: Date } } }) => Promise<number>;
    findMany: (args: {
      where: { createdAt: { gte: Date } };
      select: { signalType: true; source: true };
    }) => Promise<Array<{ signalType: string; source: string }>>;
    findFirst: (args: {
      orderBy: { createdAt: "desc" };
      select: { createdAt: true };
    }) => Promise<{ createdAt: Date } | null>;
  };
};

export type MarketSignalsOpsDeps = {
  getEnv?: EnvGetter;
  now?: () => Date;
  db?: MarketSignalsOpsDb;
  getQueueJobCounts?: () => Promise<MarketSignalsOpsQueueCounts>;
  parseSchedulerConfig?: (getEnv: EnvGetter) => MarketSignalsSchedulerConfig;
};

function defaultGetEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function isEnvConfigured(getEnv: EnvGetter, key: string): boolean {
  const value = getEnv(key);
  return value !== undefined && value.length > 0;
}

export function buildProviderReadiness(getEnv: EnvGetter): MarketSignalsOpsProviderReadiness {
  const polygonConfigured = isEnvConfigured(getEnv, "POLYGON_API_KEY");
  const eodhdConfigured = isEnvConfigured(getEnv, "EODHD_API_KEY");
  const secConfigured = isEnvConfigured(getEnv, "SEC_USER_AGENT");

  return {
    polygon: {
      apiKeyConfigured: polygonConfigured,
      usable: polygonConfigured,
    },
    eodhd: {
      apiKeyConfigured: eodhdConfigured,
      usable: eodhdConfigured,
    },
    sec: {
      userAgentConfigured: secConfigured,
      usable: secConfigured,
    },
  };
}

export function buildMarketSignalsOpsWarnings(input: {
  scheduler: MarketSignalsSchedulerConfig;
  providerReadiness: MarketSignalsOpsProviderReadiness;
  queue: MarketSignalsOpsQueueStats;
  database: MarketSignalsOpsDatabaseStats;
  queueStatsUnavailable?: boolean;
  databaseStatsUnavailable?: boolean;
  databaseErrorMessage?: string;
}): string[] {
  const warnings: string[] = [
    "Provider readiness in this endpoint is env-level only; use GET /ops/provider-check for live entitlement.",
  ];

  if (!input.providerReadiness.polygon.apiKeyConfigured) {
    warnings.push("POLYGON_API_KEY is missing or empty.");
  }
  if (!input.providerReadiness.sec.userAgentConfigured) {
    warnings.push("SEC_USER_AGENT is missing; SEC fetcher is disabled.");
  }
  if (!input.scheduler.enabled) {
    warnings.push("MarketSignals scheduler is disabled.");
  }
  if (input.queueStatsUnavailable) {
    warnings.push("Market signals queue stats unavailable.");
  } else if (input.queue.failed > 0) {
    warnings.push("Queue has failed jobs.");
  }
  if (input.databaseStatsUnavailable) {
    warnings.push(
      input.databaseErrorMessage
        ? `Database stats unavailable: ${input.databaseErrorMessage}`
        : "Database stats unavailable.",
    );
  } else if (input.database.totalSignals24h === 0) {
    warnings.push("No MarketSignals stored in last 24h.");
  }

  return warnings;
}

function emptyDatabaseStats(): MarketSignalsOpsDatabaseStats {
  return {
    totalSignals24h: 0,
    totalSignals7d: 0,
    byType24h: {},
    bySource24h: {},
    latestSignalAt: null,
  };
}

function emptyQueueStats(): MarketSignalsOpsQueueStats {
  return {
    name: MARKET_SIGNALS_QUEUE_NAME,
    waiting: 0,
    active: 0,
    delayed: 0,
    completed: 0,
    failed: 0,
  };
}

async function defaultGetQueueJobCounts(): Promise<MarketSignalsOpsQueueCounts> {
  const queue = getMarketSignalsQueue();
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "completed",
    "failed",
  );
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
  };
}

export async function loadMarketSignalsDatabaseStats(
  db: MarketSignalsOpsDb,
  now: Date,
): Promise<MarketSignalsOpsDatabaseStats> {
  const since24h = new Date(now.getTime() - MS_PER_DAY);
  const since7d = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [totalSignals24h, totalSignals7d, rows24h, latest] = await Promise.all([
    db.marketSignal.count({ where: { createdAt: { gte: since24h } } }),
    db.marketSignal.count({ where: { createdAt: { gte: since7d } } }),
    db.marketSignal.findMany({
      where: { createdAt: { gte: since24h } },
      select: { signalType: true, source: true },
    }),
    db.marketSignal.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const byType24h: Partial<Record<MarketSignalType, number>> = {};
  const bySource24h: Record<string, number> = {};

  for (const row of rows24h) {
    const signalType = row.signalType as MarketSignalType;
    byType24h[signalType] = (byType24h[signalType] ?? 0) + 1;
    bySource24h[row.source] = (bySource24h[row.source] ?? 0) + 1;
  }

  return {
    totalSignals24h,
    totalSignals7d,
    byType24h,
    bySource24h,
    latestSignalAt: latest?.createdAt.toISOString() ?? null,
  };
}

export async function buildMarketSignalsOpsHealth(
  depsInput?: MarketSignalsOpsDeps,
): Promise<MarketSignalsOpsHealthResponse> {
  const getEnv = depsInput?.getEnv ?? defaultGetEnv;
  const now = depsInput?.now?.() ?? new Date();
  const db = depsInput?.db ?? defaultPrisma;
  const parseSchedulerConfig = depsInput?.parseSchedulerConfig ?? parseMarketSignalsSchedulerConfig;
  const getQueueJobCounts = depsInput?.getQueueJobCounts ?? defaultGetQueueJobCounts;

  const schedulerConfig = parseSchedulerConfig(getEnv);
  const providerReadiness = buildProviderReadiness(getEnv);

  let queue = emptyQueueStats();
  let queueStatsUnavailable = false;

  try {
    const counts = await getQueueJobCounts();
    queue = {
      name: MARKET_SIGNALS_QUEUE_NAME,
      waiting: counts.waiting,
      active: counts.active,
      delayed: counts.delayed,
      completed: counts.completed,
      failed: counts.failed,
    };
  } catch {
    queueStatsUnavailable = true;
  }

  let database = emptyDatabaseStats();
  let databaseStatsUnavailable = false;
  let databaseErrorMessage: string | undefined;

  try {
    database = await loadMarketSignalsDatabaseStats(db, now);
  } catch (error) {
    databaseStatsUnavailable = true;
    databaseErrorMessage = error instanceof Error ? error.message : "unknown error";
  }

  const warnings = buildMarketSignalsOpsWarnings({
    scheduler: schedulerConfig,
    providerReadiness,
    queue,
    database,
    queueStatsUnavailable,
    databaseStatsUnavailable,
    databaseErrorMessage,
  });

  return {
    ok: !databaseStatsUnavailable,
    generatedAt: now.toISOString(),
    scheduler: {
      enabled: schedulerConfig.enabled,
      intervalMinutes: schedulerConfig.intervalMinutes,
      maxTickers: schedulerConfig.maxTickers,
      configuredTickers: schedulerConfig.tickers,
      configuredProviders: schedulerConfig.providers,
    },
    providerReadiness,
    queue,
    database,
    warnings,
  };
}
