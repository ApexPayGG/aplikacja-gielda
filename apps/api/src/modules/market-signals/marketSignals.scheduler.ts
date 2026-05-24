import { parseMarketSignalProvider } from "./marketSignals.ingestion";
import { FETCH_TICKER_PATTERN, normalizeFetchTicker } from "./marketSignals.fetchers";
import {
  enqueueFetchProviderAndIngest,
  getMarketSignalsQueue,
  MARKET_SIGNALS_JOB_NAMES,
  type MarketSignalsQueueDeps,
} from "./marketSignals.queue";
import type { MarketSignalProvider } from "./marketSignals.types";
import { MARKET_SIGNAL_PROVIDERS } from "./marketSignals.types";

export const MARKET_SIGNALS_SCHEDULER_REPEAT_JOB_ID = "market-signals-scheduler-batch";
export const SCHEDULED_MARKET_SIGNALS_REASON = "scheduled-market-signals";

export const DEFAULT_MARKET_SIGNALS_SCHEDULER_TICKERS = ["AAPL", "MSFT", "NVDA"] as const;
export const DEFAULT_MARKET_SIGNALS_SCHEDULER_PROVIDERS: MarketSignalProvider[] = [
  "EODHD_INSIDER_ACTIVITY",
];
export const DEFAULT_MARKET_SIGNALS_SCHEDULER_INTERVAL_MINUTES = 240;
export const DEFAULT_MARKET_SIGNALS_SCHEDULER_MAX_TICKERS = 25;

export const POLYGON_SCHEDULER_PROVIDERS: MarketSignalProvider[] = [
  "POLYGON_DARK_POOL",
  "POLYGON_OPTIONS_FLOW",
];

export type MarketSignalsSchedulerConfig = {
  enabled: boolean;
  tickers: string[];
  providers: MarketSignalProvider[];
  intervalMinutes: number;
  maxTickers: number;
};

export type MarketSignalsSchedulerLogger = {
  info: (event: string, meta?: Record<string, unknown>) => void;
};

type EnvGetter = (key: string) => string | undefined;

function defaultGetEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function defaultLogger(): MarketSignalsSchedulerLogger {
  return {
    info: (event, meta = {}) => {
      console.log(JSON.stringify({ level: "info", event, ...meta }));
    },
  };
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isMarketSignalsSchedulerEnabled(getEnv: EnvGetter = defaultGetEnv): boolean {
  return getEnv("MARKET_SIGNALS_SCHEDULER_ENABLED") === "true";
}

export function isMarketSignalsAllowPolygonScheduler(getEnv: EnvGetter = defaultGetEnv): boolean {
  return getEnv("MARKET_SIGNALS_ALLOW_POLYGON_SCHEDULER") === "true";
}

function isPolygonSchedulerProvider(provider: MarketSignalProvider): boolean {
  return POLYGON_SCHEDULER_PROVIDERS.includes(provider);
}

function parseValidSchedulerProviders(rawProviders: string[]): MarketSignalProvider[] {
  const providers: MarketSignalProvider[] = [];
  const seenProviders = new Set<MarketSignalProvider>();
  for (const rawProvider of rawProviders) {
    const provider = parseMarketSignalProvider(rawProvider);
    if (!provider || !MARKET_SIGNAL_PROVIDERS.includes(provider)) continue;
    if (seenProviders.has(provider)) continue;
    seenProviders.add(provider);
    providers.push(provider);
  }
  return providers;
}

function warnPolygonProvidersConfiguredWithoutOverride(
  rawProviders: string[],
  getEnv: EnvGetter,
): void {
  if (!isMarketSignalsSchedulerEnabled(getEnv) || isMarketSignalsAllowPolygonScheduler(getEnv)) {
    return;
  }

  const polygonProviders = rawProviders
    .map((rawProvider) => parseMarketSignalProvider(rawProvider))
    .filter(
      (provider): provider is MarketSignalProvider =>
        provider !== null &&
        MARKET_SIGNAL_PROVIDERS.includes(provider) &&
        isPolygonSchedulerProvider(provider),
    );

  if (polygonProviders.length === 0) {
    return;
  }

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "market_signals_scheduler_polygon_configured_without_override",
      providers: polygonProviders,
      hint: "Set MARKET_SIGNALS_ALLOW_POLYGON_SCHEDULER=true after provider-check confirms Polygon entitlement.",
    }),
  );
}

export function applySchedulerProviderGuards(
  parsedProviders: MarketSignalProvider[],
  getEnv: EnvGetter,
  logger?: MarketSignalsSchedulerLogger,
): MarketSignalProvider[] {
  const allowPolygon = isMarketSignalsAllowPolygonScheduler(getEnv);
  const hasSecUserAgent = Boolean(getEnv("SEC_USER_AGENT"));
  const allowed: MarketSignalProvider[] = [];
  const seenProviders = new Set<MarketSignalProvider>();

  for (const provider of parsedProviders) {
    if (seenProviders.has(provider)) continue;

    if (isPolygonSchedulerProvider(provider) && !allowPolygon) {
      logger?.info("market_signals_scheduler_polygon_skipped_no_override", { provider });
      continue;
    }

    if (provider === "SEC_FILINGS" && !hasSecUserAgent) {
      logger?.info("market_signals_scheduler_sec_skipped_missing_user_agent", { provider });
      continue;
    }

    seenProviders.add(provider);
    allowed.push(provider);
    logger?.info("market_signals_scheduler_provider_allowed", { provider });
  }

  return allowed;
}

function resolveSchedulerProviderSource(
  enabled: boolean,
  getEnv: EnvGetter,
): { rawProviders: string[]; parsedProviders: MarketSignalProvider[] } {
  const rawProviders = parseCsv(getEnv("MARKET_SIGNALS_SCHEDULER_PROVIDERS"));
  const providerSource =
    enabled && rawProviders.length === 0
      ? [...DEFAULT_MARKET_SIGNALS_SCHEDULER_PROVIDERS]
      : rawProviders;

  return {
    rawProviders: providerSource,
    parsedProviders: parseValidSchedulerProviders(providerSource),
  };
}

function resolveSchedulerTickers(
  enabled: boolean,
  getEnv: EnvGetter,
  maxTickers: number,
): string[] {
  const rawTickers = parseCsv(getEnv("MARKET_SIGNALS_SCHEDULER_TICKERS"));
  const tickerSource =
    enabled && rawTickers.length === 0 ? [...DEFAULT_MARKET_SIGNALS_SCHEDULER_TICKERS] : rawTickers;

  const tickers: string[] = [];
  const seenTickers = new Set<string>();
  for (const rawTicker of tickerSource) {
    const normalized = normalizeFetchTicker(rawTicker);
    if (!normalized || !FETCH_TICKER_PATTERN.test(normalized)) {
      continue;
    }
    if (seenTickers.has(normalized)) continue;
    seenTickers.add(normalized);
    tickers.push(normalized);
    if (tickers.length >= maxTickers) break;
  }

  return tickers;
}

export function parseMarketSignalsSchedulerConfig(
  getEnv: EnvGetter = defaultGetEnv,
): MarketSignalsSchedulerConfig {
  const enabled = isMarketSignalsSchedulerEnabled(getEnv);
  const maxTickers = parsePositiveInt(
    getEnv("MARKET_SIGNALS_SCHEDULER_MAX_TICKERS"),
    DEFAULT_MARKET_SIGNALS_SCHEDULER_MAX_TICKERS,
  );
  const intervalMinutes = parsePositiveInt(
    getEnv("MARKET_SIGNALS_SCHEDULER_INTERVAL_MINUTES"),
    DEFAULT_MARKET_SIGNALS_SCHEDULER_INTERVAL_MINUTES,
  );

  const { rawProviders, parsedProviders } = resolveSchedulerProviderSource(enabled, getEnv);
  if (enabled) {
    warnPolygonProvidersConfiguredWithoutOverride(rawProviders, getEnv);
  }

  const tickers = resolveSchedulerTickers(enabled, getEnv, maxTickers);
  const providers = applySchedulerProviderGuards(parsedProviders, getEnv);

  return {
    enabled,
    tickers,
    providers,
    intervalMinutes,
    maxTickers,
  };
}

export function resolveMarketSignalsSchedulerPairs(
  config: MarketSignalsSchedulerConfig,
  deps?: {
    getEnv?: EnvGetter;
    logger?: MarketSignalsSchedulerLogger;
  },
): Array<{ ticker: string; provider: MarketSignalProvider }> {
  const getEnv = deps?.getEnv ?? defaultGetEnv;
  const logger = deps?.logger ?? defaultLogger();

  const rawTickers = parseCsv(getEnv("MARKET_SIGNALS_SCHEDULER_TICKERS"));
  const tickerSource =
    config.enabled && rawTickers.length === 0 ? [...DEFAULT_MARKET_SIGNALS_SCHEDULER_TICKERS] : rawTickers;

  const { rawProviders, parsedProviders } = resolveSchedulerProviderSource(config.enabled, getEnv);

  const validTickers: string[] = [];
  const seenTickers = new Set<string>();
  for (const rawTicker of tickerSource) {
    const normalized = normalizeFetchTicker(rawTicker);
    if (!normalized || !FETCH_TICKER_PATTERN.test(normalized)) {
      logger.info("market_signals_scheduler_invalid_ticker_skipped", { ticker: rawTicker });
      continue;
    }
    if (seenTickers.has(normalized)) continue;
    seenTickers.add(normalized);
    validTickers.push(normalized);
    if (validTickers.length >= config.maxTickers) break;
  }

  const invalidProviderEntries = parseCsv(getEnv("MARKET_SIGNALS_SCHEDULER_PROVIDERS")).filter(
    (rawProvider) => {
      const provider = parseMarketSignalProvider(rawProvider);
      return !provider || !MARKET_SIGNAL_PROVIDERS.includes(provider);
    },
  );
  for (const rawProvider of invalidProviderEntries) {
    logger.info("market_signals_scheduler_invalid_provider_skipped", { provider: rawProvider });
  }

  const validProviders = applySchedulerProviderGuards(parsedProviders, getEnv, logger);

  if (config.enabled) {
    warnPolygonProvidersConfiguredWithoutOverride(rawProviders, getEnv);
  }

  const pairs: Array<{ ticker: string; provider: MarketSignalProvider }> = [];
  for (const ticker of validTickers) {
    for (const provider of validProviders) {
      pairs.push({ ticker, provider });
    }
  }
  return pairs;
}

export async function enqueueScheduledMarketSignalFetchJobs(
  config: MarketSignalsSchedulerConfig,
  deps?: {
    enqueueFetch?: typeof enqueueFetchProviderAndIngest;
    logger?: MarketSignalsSchedulerLogger;
    getEnv?: EnvGetter;
    now?: () => number;
    queue?: MarketSignalsQueueDeps["queue"];
  },
): Promise<{ enqueued: number }> {
  const logger = deps?.logger ?? defaultLogger();
  const enqueueFetch = deps?.enqueueFetch ?? enqueueFetchProviderAndIngest;
  const pairs = resolveMarketSignalsSchedulerPairs(config, {
    getEnv: deps?.getEnv,
    logger,
  });

  let enqueued = 0;
  let sequence = 0;
  const baseNow = deps?.now?.() ?? Date.now();

  for (const pair of pairs) {
    sequence += 1;
    const result = await enqueueFetch(
      {
        provider: pair.provider,
        ticker: pair.ticker,
        reason: SCHEDULED_MARKET_SIGNALS_REASON,
      },
      deps?.queue
        ? {
            queue: deps.queue,
            now: () => baseNow + sequence,
          }
        : {
            now: () => baseNow + sequence,
          },
    );
    enqueued += 1;
    logger.info("market_signals_scheduler_job_enqueued", {
      provider: pair.provider,
      ticker: pair.ticker,
      jobId: result.jobId,
    });
  }

  return { enqueued };
}

export type RegisterMarketSignalsSchedulerDeps = {
  getEnv?: EnvGetter;
  logger?: MarketSignalsSchedulerLogger;
  queue?: {
    add: (
      name: string,
      data: unknown,
      options?: { jobId?: string; repeat?: { every: number } },
    ) => Promise<{ id?: string | null }>;
  };
  enqueueScheduledJobs?: typeof enqueueScheduledMarketSignalFetchJobs;
};

export async function registerMarketSignalsScheduler(
  depsInput?: RegisterMarketSignalsSchedulerDeps,
): Promise<{ enabled: boolean; scheduled: boolean; intervalMinutes: number }> {
  const getEnv = depsInput?.getEnv ?? defaultGetEnv;
  const logger = depsInput?.logger ?? defaultLogger();
  const config = parseMarketSignalsSchedulerConfig(getEnv);

  if (!config.enabled) {
    console.log("[scheduler] MarketSignals scheduler disabled (MARKET_SIGNALS_SCHEDULER_ENABLED != true)");
    logger.info("market_signals_scheduler_disabled", {
      flag: getEnv("MARKET_SIGNALS_SCHEDULER_ENABLED") ?? "",
    });
    return { enabled: false, scheduled: false, intervalMinutes: config.intervalMinutes };
  }

  const queue = depsInput?.queue ?? getMarketSignalsQueue();
  await queue.add(
    MARKET_SIGNALS_JOB_NAMES.SCHEDULE_MARKET_SIGNALS_BATCH,
    {},
    {
      jobId: MARKET_SIGNALS_SCHEDULER_REPEAT_JOB_ID,
      repeat: { every: config.intervalMinutes * 60 * 1000 },
    },
  );

  logger.info("market_signals_scheduler_started", {
    tickers: config.tickers,
    providers: config.providers,
    intervalMinutes: config.intervalMinutes,
    maxTickers: config.maxTickers,
    pairCount: config.tickers.length * config.providers.length,
    allowPolygonScheduler: isMarketSignalsAllowPolygonScheduler(getEnv),
  });

  return {
    enabled: true,
    scheduled: true,
    intervalMinutes: config.intervalMinutes,
  };
}

export function createMarketSignalsScheduledBatchRunner(deps?: {
  getEnv?: EnvGetter;
  logger?: MarketSignalsSchedulerLogger;
  enqueueScheduledJobs?: typeof enqueueScheduledMarketSignalFetchJobs;
}): () => Promise<{ enqueued: number }> {
  return async () => {
    const getEnv = deps?.getEnv ?? defaultGetEnv;
    const logger = deps?.logger ?? defaultLogger();
    const config = parseMarketSignalsSchedulerConfig(getEnv);
    if (!config.enabled) {
      logger.info("market_signals_scheduler_disabled", {
        flag: getEnv("MARKET_SIGNALS_SCHEDULER_ENABLED") ?? "",
      });
      return { enqueued: 0 };
    }
    return (deps?.enqueueScheduledJobs ?? enqueueScheduledMarketSignalFetchJobs)(config, {
      getEnv,
      logger,
    });
  };
}
