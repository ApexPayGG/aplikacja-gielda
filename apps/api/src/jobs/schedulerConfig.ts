import pino from "pino";

/** Standard BullMQ retry for data-ingest jobs (429 / timeouts / 5xx). */
export const STANDARD_INGEST_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;

/** Real-time / intraday ingest — Mon–Fri UTC (major exchanges closed Sat–Sun). */
export const WEEKDAY_REALTIME_CRON = {
  EVERY_5_MIN: "*/5 * * * 1-5",
  HOURLY: "0 * * * 1-5",
} as const;

/** EOD batch imports — weekdays only to preserve API quotas. */
export const WEEKDAY_EOD_CRON = {
  DIVIDEND_0100: "0 1 * * 1-5",
  EODHD_GPW_0130: "30 1 * * 1-5",
  EODHD_GLOBAL_0200: "0 2 * * 1-5",
  FUNDAMENTALS_0300: "0 3 * * 1-5",
  PORTFOLIO_1700: "0 17 * * 1-5",
} as const;

export const ingestLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { component: "data_ingest" },
});

export type IngestJobContext = {
  queue: string;
  provider: string;
  jobId?: string | number;
  jobName?: string;
};

export function formatIngestError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isRetryableIngestError(err: unknown): boolean {
  const msg = formatIngestError(err);
  if (/429|rate limit|too many requests|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|circuit open/i.test(msg)) {
    return true;
  }
  const status = (err as { status?: number })?.status;
  if (status === 429 || (typeof status === "number" && status >= 500)) return true;
  return false;
}

/**
 * Skip real-time / intraday market data fetches on weekends (GPW, NYSE, DAX, TSE closed).
 * Set INGEST_DISABLE_MARKET_HOURS_SKIP=true to force runs (e.g. staging).
 */
export function shouldSkipRealtimeMarketIngest(now = new Date()): boolean {
  if (process.env.INGEST_DISABLE_MARKET_HOURS_SKIP === "true") return false;
  const day = now.getUTCDay();
  return day === 0 || day === 6;
}

export type IngestSkipResult = { skipped: true; reason: "weekend_market_closed" };

export async function runIngestJob<T>(
  ctx: IngestJobContext,
  fn: () => Promise<T>,
  options?: { respectMarketHours?: boolean },
): Promise<T | IngestSkipResult> {
  const log = ingestLogger.child({
    queue: ctx.queue,
    provider: ctx.provider,
    jobId: ctx.jobId,
    jobName: ctx.jobName,
  });

  if (options?.respectMarketHours !== false && shouldSkipRealtimeMarketIngest()) {
    log.info(
      { event: "ingest_skipped", reason: "weekend_market_closed" },
      "ingest job skipped — global exchanges closed (weekend UTC)",
    );
    return { skipped: true, reason: "weekend_market_closed" };
  }

  log.info({ event: "ingest_start" }, "ingest job started");
  try {
    const result = await fn();
    log.info({ event: "ingest_success" }, "ingest job completed");
    return result;
  } catch (err) {
    log.error(
      {
        event: "ingest_failure",
        provider: ctx.provider,
        err: formatIngestError(err),
        retryable: isRetryableIngestError(err),
      },
      "ingest job failed — BullMQ will retry if attempts remain",
    );
    throw err;
  }
}
