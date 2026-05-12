import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { prisma } from "../db/index";
import { processSignalQueue } from "../queues/processSignal";
import { getCacheRedis } from "../redis";
import { loadTopDividendSymbols } from "../services/dividendDataService";

export const SCAN_SIGNALS_QUEUE_NAME = "scan-signals";
export const ALERT_QUEUE_NAME = "alert-push";
const TOP_TICKERS_CACHE_KEY = "scan-signals:top_tickers";
const TOP_TICKERS_TTL_SEC = 60 * 5;
const SCANNER_BASE_URL = (process.env.SCANNER_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export interface ScanSignalsResult {
  processed: number;
  signals_created: number;
  alerts_queued: number;
}

export interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ScannerResponse {
  anomalies: unknown[];
  patterns: unknown[];
}

interface DetectedSignalLike {
  type?: string;
  confidence?: number;
}

type QuoteRow = {
  symbol?: string;
  timestamp: Date;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  volume: bigint;
};

export interface ScanSignalsDeps {
  db: typeof prisma;
  cache: Pick<ReturnType<typeof getCacheRedis>, "get" | "setex">;
  processSignalQueue: Pick<Queue, "add">;
  fetchAnalyze: (input: { ticker: string; bars: MarketBar[] }) => Promise<ScannerResponse>;
  loadTopTickers: (limit: number) => Promise<string[]>;
}

export const scanSignalsLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "scan_signals_job" },
});

function normalizeBars(rows: Array<{ timestamp: Date; open: unknown; high: unknown; low: unknown; close: unknown; volume: bigint }>): MarketBar[] {
  return rows
    .slice()
    .reverse()
    .map((row) => ({
      timestamp: row.timestamp.toISOString(),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    }));
}

function calculateConfidence(anomaliesCount: number, patternsCount: number): number {
  const raw = 45 + anomaliesCount * 12 + patternsCount * 18;
  return Math.min(99, Math.max(50, raw));
}

function tickerBase(input: string): string {
  const normalized = input.trim().toUpperCase();
  const base = normalized.split(".")[0] ?? normalized;
  return base.trim();
}

function normalizeExchangeSuffix(exchange: string | null | undefined): string | null {
  if (!exchange) return null;
  const cleaned = exchange.trim().replace(/^\.+/, "").toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

function quoteSelect() {
  return { timestamp: true, open: true, high: true, low: true, close: true, volume: true, symbol: true } as const;
}

async function fetchQuotesForTicker(
  deps: ScanSignalsDeps,
  ticker: string,
): Promise<QuoteRow[]> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const base = tickerBase(normalizedTicker);
  if (!base) return [];

  // Primary query: exact symbol, plain base symbol, and any suffix variant.
  const primaryRows = await deps.db.quote.findMany({
    where: {
      OR: [
        { symbol: normalizedTicker },
        { symbol: base },
        { symbol: { startsWith: `${base}.` } },
      ],
    },
    orderBy: { timestamp: "desc" },
    take: 30,
    select: quoteSelect(),
  });
  if (primaryRows.length > 0) return primaryRows as QuoteRow[];

  // Fallback: try symbol + exchange suffix from companies table.
  const companyAccessor = (deps.db as unknown as { company?: { findFirst?: Function } }).company;
  const companyRow = companyAccessor?.findFirst
    ? (await companyAccessor.findFirst({
        where: {
          OR: [
            { symbol: normalizedTicker },
            { symbol: base },
            { symbol: { startsWith: `${base}.` } },
          ],
        },
        select: { exchange: true },
      })) as { exchange?: string | null } | null
    : null;
  const suffix = normalizeExchangeSuffix(companyRow?.exchange);
  if (!suffix) return [];
  const fallbackSymbol = `${base}.${suffix}`;
  if (fallbackSymbol === normalizedTicker) return [];

  const fallbackRows = await deps.db.quote.findMany({
    where: { symbol: fallbackSymbol },
    orderBy: { timestamp: "desc" },
    take: 30,
    select: quoteSelect(),
  });
  return fallbackRows as QuoteRow[];
}

function resolveConfidence(
  anomalies: unknown[],
  patterns: unknown[],
): number {
  const patternConfidence = Number((patterns[0] as DetectedSignalLike | undefined)?.confidence);
  if (Number.isFinite(patternConfidence)) {
    return Math.min(99, Math.max(1, Math.round(patternConfidence)));
  }
  const anomalyConfidence = Number((anomalies[0] as DetectedSignalLike | undefined)?.confidence);
  if (Number.isFinite(anomalyConfidence)) {
    return Math.min(99, Math.max(1, Math.round(anomalyConfidence)));
  }
  return calculateConfidence(anomalies.length, patterns.length);
}

function calculateBacktestData(bars: MarketBar[], confidence: number): {
  historical_count: number;
  win_rate: number;
  avg_return_10d: number;
  max_drawdown: number;
} {
  if (bars.length < 2) {
    return { historical_count: 0, win_rate: 0, avg_return_10d: 0, max_drawdown: 0 };
  }

  let winningSteps = 0;
  let maxDrawdown = 0;
  let currentPeak = bars[0]?.close ?? 0;
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1];
    const curr = bars[i];
    if (!prev || !curr || prev.close === 0) continue;
    if (curr.close > prev.close) winningSteps += 1;
    if (curr.close > currentPeak) currentPeak = curr.close;
    if (currentPeak > 0) {
      const drawdown = ((currentPeak - curr.close) / currentPeak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  const first = bars[0]?.close ?? 0;
  const last = bars[bars.length - 1]?.close ?? 0;
  const avgReturn10d = first > 0 ? ((last - first) / first) * 100 : 0;
  const winRate = ((winningSteps / Math.max(1, bars.length - 1)) * 100 + confidence / 4) / 1.25;

  return {
    historical_count: bars.length,
    win_rate: Math.max(0, Math.min(100, Number(winRate.toFixed(2)))),
    avg_return_10d: Number(avgReturn10d.toFixed(4)),
    max_drawdown: Number(maxDrawdown.toFixed(4)),
  };
}

async function getTopTickersFromCacheOrDb(
  deps: Pick<ScanSignalsDeps, "cache" | "loadTopTickers">,
  limit: number,
): Promise<string[]> {
  const cached = await deps.cache.get(TOP_TICKERS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, limit);
    } catch {
      // ignore malformed cache and fall back to DB/service
    }
  }
  const tickers = await deps.loadTopTickers(limit);
  await deps.cache.setex(TOP_TICKERS_CACHE_KEY, TOP_TICKERS_TTL_SEC, JSON.stringify(tickers));
  return tickers;
}

async function defaultFetchAnalyze(input: { ticker: string; bars: MarketBar[] }): Promise<ScannerResponse> {
  // Chosen integration: REST call to scanner microservice.
  const res = await fetch(`${SCANNER_BASE_URL}/scanner/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Scanner service failed (${res.status}) for ${input.ticker}`);
  }
  return (await res.json()) as ScannerResponse;
}

export async function runScanSignalsJob(depsInput?: Partial<ScanSignalsDeps>): Promise<ScanSignalsResult> {
  const cache = depsInput?.cache ?? getCacheRedis();
  const deps: ScanSignalsDeps = {
    db: depsInput?.db ?? prisma,
    cache,
    processSignalQueue: depsInput?.processSignalQueue ?? processSignalQueue,
    fetchAnalyze: depsInput?.fetchAnalyze ?? defaultFetchAnalyze,
    loadTopTickers: depsInput?.loadTopTickers ?? loadTopDividendSymbols,
  };
  const out: ScanSignalsResult = { processed: 0, signals_created: 0, alerts_queued: 0 };
  const tickers = await getTopTickersFromCacheOrDb(deps, 30);
  const quoteRowsByTicker = new Map<string, QuoteRow[]>();
  const eligibleTickers: string[] = [];

  for (const ticker of tickers) {
    out.processed += 1;
    try {
      const rows = await fetchQuotesForTicker(deps, ticker);
      if (rows.length === 0) {
        scanSignalsLogger.info({ msg: "skip_no_quotes", ticker });
        continue;
      }
      if (rows.length < 10) {
        scanSignalsLogger.info({ msg: "skip_not_enough_bars", ticker, bars: rows.length });
        continue;
      }
      quoteRowsByTicker.set(ticker, rows);
      eligibleTickers.push(ticker);
    } catch (error) {
      scanSignalsLogger.error({
        msg: "scan_failed_for_ticker",
        ticker,
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const ticker of eligibleTickers) {
    try {
      const rows = quoteRowsByTicker.get(ticker);
      if (!rows || rows.length < 10) continue;
      const bars = normalizeBars(rows);
      const scanResult = await deps.fetchAnalyze({ ticker, bars });
      const anomalies = Array.isArray(scanResult.anomalies) ? scanResult.anomalies : [];
      const patterns = Array.isArray(scanResult.patterns) ? scanResult.patterns : [];
      if (anomalies.length === 0 && patterns.length === 0) continue;

      const confidence = resolveConfidence(anomalies, patterns);
      const backtest = calculateBacktestData(bars, confidence);
      const patternType = String(
        (patterns[0] as { type?: string } | undefined)?.type ??
          (anomalies[0] as { type?: string } | undefined)?.type ??
          "scanner_signal",
      );
      const latestSignal = await deps.db.signal.create({
        data: {
          ticker: ticker.toUpperCase(),
          exchange: "US",
          pattern_type: patternType,
          confidence,
          technical_data: { anomalies, patterns, barsCount: bars.length },
          historical_count: backtest.historical_count,
          win_rate: backtest.win_rate,
          avg_return_10d: backtest.avg_return_10d,
          max_drawdown: backtest.max_drawdown,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          user_triggered: false,
        },
      });
      out.signals_created += 1;

      // Enqueue signal processing (brief + scoring via Claude)
      await deps.processSignalQueue.add("process:signal", { signalId: latestSignal.id });
      out.alerts_queued += 1;
      scanSignalsLogger.info({
        msg: "signal_created",
        ticker,
        confidence,
        anomalies: anomalies.length,
        patterns: patterns.length,
        processJobsQueuedForTicker: 1,
      });
    } catch (error) {
      scanSignalsLogger.error({
        msg: "analyze_failed_for_ticker",
        ticker,
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  scanSignalsLogger.info({ msg: "scan_signals_finished", ...out });
  return out;
}

export function registerScanSignals(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker; alertQueue: Queue } {
  const queue = new Queue(SCAN_SIGNALS_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    },
  });
  const alertQueue = new Queue(ALERT_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  });
  const worker = new Worker(
    SCAN_SIGNALS_QUEUE_NAME,
    async (job) => {
      scanSignalsLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const result = await runScanSignalsJob({ alertQueue });
      scanSignalsLogger.info({ msg: "end", jobId: job.id, ...result });
      return result;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    scanSignalsLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker, alertQueue };
}

export async function scheduleScanSignalsJob(queue: Queue): Promise<void> {
  await queue.add(
    "scan",
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: "scan-signals-every-5-min",
    },
  );
}
