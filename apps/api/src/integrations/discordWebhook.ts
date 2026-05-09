import pino from "pino";
import { getCacheRedis } from "../redis";

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

interface SignalAlertMeta {
  confidence?: number;
  timeframe?: string;
  setup?: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  logicalChannel?: string;
  marketRegime?: string;
  regimeConfidence?: number;
  playbookAction?: string;
  signalDna?: string;
  narrativeHeadline?: string;
  narrativeBody?: string;
  narrativeRisk?: string;
  narrativeConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

interface SignalAlertInput {
  ticker: string;
  signal: string;
  score: number;
  brief: string;
  meta?: SignalAlertMeta;
}

interface DispatcherOptions {
  maxPerMinute?: number;
  minuteMs?: number;
  batchIntervalMs?: number;
  smallSignalThreshold?: number;
  criticalSignalThreshold?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  fetchFn?: FetchLike;
  redisClient?: RedisLike;
}

interface RedisLike {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  rpush: (key: string, value: string) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  lpop: (key: string) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "discord_webhook_integration" },
});

function buildChartLink(ticker: string): string {
  return `https://www.tradingview.com/symbols/${encodeURIComponent(ticker.toUpperCase())}/`;
}

function normalizeBrief(brief: string): string {
  const text = brief.trim().replace(/\s+/g, " ");
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function riskBand(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 75) return "LOW";
  if (score >= 50) return "MEDIUM";
  return "HIGH";
}

function signalEmoji(score: number): string {
  if (score >= 75) return "🟢";
  if (score >= 50) return "🟡";
  return "🔴";
}

function scoreColor(score: number): number {
  if (score >= 75) return 0x22c55e;
  if (score >= 50) return 0xf59e0b;
  return 0xef4444;
}

function formatPrice(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return "n/a";
  return value.toFixed(2);
}

function buildEmbed(
  ticker: string,
  signal: string,
  score: number,
  brief: string,
  meta?: SignalAlertMeta,
): Record<string, unknown> {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const chartLink = buildChartLink(ticker);
  const band = riskBand(safeScore);
  const emoji = signalEmoji(safeScore);
  const setup = meta?.setup ?? signal;
  const timeframe = meta?.timeframe ?? "swing (1D)";
  const confidence = meta?.confidence ?? 0;
  const modelConfidenceText = confidence > 0 ? `${Math.max(0, Math.min(100, Math.round(confidence)))}%` : "n/a";
  const narrativeConfidence = meta?.narrativeConfidence ?? "MEDIUM";
  return {
    title: meta?.narrativeHeadline?.trim() || `${emoji} ${ticker.toUpperCase()} • ${signal}`,
    description: meta?.narrativeBody?.trim() || `**AI Brief**\n${normalizeBrief(brief)}`,
    color: scoreColor(safeScore),
    fields: [
      { name: "Ticker", value: `\`${ticker.toUpperCase()}\``, inline: true },
      { name: "Setup", value: setup, inline: true },
      { name: "Timeframe", value: timeframe, inline: true },
      { name: "Risk Score", value: `**${safeScore}/100** (${band})`, inline: true },
      { name: "Model Confidence", value: modelConfidenceText, inline: true },
      { name: "Confidence", value: narrativeConfidence, inline: true },
      ...(meta?.marketRegime
        ? [
            {
              name: "Market Regime",
              value: `${meta.marketRegime} (${Math.max(0, Math.min(100, Math.round(meta.regimeConfidence ?? 0)))}%)`,
              inline: true,
            },
          ]
        : []),
      {
        name: "Levels",
        value: `Entry: ${formatPrice(meta?.entry)} | SL: ${formatPrice(meta?.stopLoss)} | TP: ${formatPrice(meta?.takeProfit)}`,
        inline: false,
      },
      { name: "Chart", value: `[Open on TradingView](${chartLink})`, inline: true },
      {
        name: "Action",
        value: meta?.playbookAction ?? "Confirm setup with your strategy before entry.",
        inline: false,
      },
      ...(meta?.signalDna
        ? [
            {
              name: "Signal DNA",
              value: meta.signalDna,
              inline: false,
            },
          ]
        : []),
    ],
    thumbnail: {
      url: "https://s3.tradingview.com/static/bundles/chart-widget-logo.svg",
    },
    footer: { text: meta?.narrativeRisk?.trim() || "Stock-AI Pro • Discord Signal Alert" },
    timestamp: new Date().toISOString(),
  };
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sendDiscordPayloadWithRetry(
  payload: Record<string, unknown>,
  fetchFn: FetchLike,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        if (shouldRetry(res.status)) {
          throw new Error(`discord_webhook_retryable_${res.status}: ${body}`);
        }
        throw new Error(`discord_webhook_failed_${res.status}: ${body}`);
      }
      return;
    } catch (error) {
      lastError = error;
      logger.warn({
        msg: "discord_webhook_attempt_failed",
        attempt,
        err: error instanceof Error ? error.message : String(error),
      });
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
}

function resolveLogicalChannel(signal: string, meta?: SignalAlertMeta): string {
  const fromMeta = meta?.logicalChannel?.trim();
  if (fromMeta) return fromMeta.toLowerCase();
  return signal.trim().toLowerCase().replace(/\s+/g, "_") || "general";
}

export class DiscordSignalAlertDispatcher {
  private readonly maxPerMinute: number;

  private readonly minuteMs: number;

  private readonly batchIntervalMs: number;

  private readonly smallSignalThreshold: number;

  private readonly criticalSignalThreshold: number;

  private readonly fetchFn: FetchLike;

  private readonly redis: RedisLike;

  private readonly now: () => number;

  private readonly redisKeyPrefix = "discord:alerts";

  constructor(options?: DispatcherOptions) {
    this.maxPerMinute = options?.maxPerMinute ?? 10;
    this.minuteMs = options?.minuteMs ?? 60_000;
    this.batchIntervalMs = options?.batchIntervalMs ?? 5 * 60_000;
    this.smallSignalThreshold = options?.smallSignalThreshold ?? 60;
    this.criticalSignalThreshold = options?.criticalSignalThreshold ?? 80;
    this.redis = options?.redisClient ?? (getCacheRedis() as unknown as RedisLike);
    this.now = options?.now ?? Date.now;
    this.fetchFn = options?.fetchFn ?? ((globalThis.fetch as unknown) as FetchLike);
  }

  async dispatchSignalAlert(input: SignalAlertInput): Promise<void> {
    const channel = resolveLogicalChannel(input.signal, input.meta);
    if (input.score > this.criticalSignalThreshold) {
      await this.sendSingle(input);
      return;
    }
    if (input.score < this.smallSignalThreshold) {
      await this.enqueueBatch(channel, input);
      return;
    }
    await this.enqueueRegular(channel, input);
  }

  async flushAllBatches(): Promise<void> {
    const channels = await this.redis.smembers(this.channelsKey());
    for (const channel of channels) {
      await this.flushSmallBatch(channel);
      await this.drainRegularQueue(channel);
    }
  }

  private async sendSingle(input: SignalAlertInput): Promise<void> {
    const payload = {
      username: "Stock-AI Pro Alerts",
      embeds: [buildEmbed(input.ticker, input.signal, input.score, input.brief, input.meta)],
    };
    await sendDiscordPayloadWithRetry(payload, this.fetchFn);
  }

  private async enqueueBatch(channel: string, input: SignalAlertInput): Promise<void> {
    await this.redis.sadd(this.channelsKey(), channel);
    await this.redis.rpush(this.smallBatchListKey(channel), JSON.stringify(input));
  }

  private async enqueueRegular(channel: string, input: SignalAlertInput): Promise<void> {
    await this.redis.sadd(this.channelsKey(), channel);
    const allowed = await this.tryAcquireRateSlot(channel);
    if (allowed) {
      await this.sendSingle(input);
      return;
    }
    await this.redis.rpush(this.regularQueueListKey(channel), JSON.stringify(input));
  }

  private async flushSmallBatch(channel: string): Promise<void> {
    const itemsRaw = await this.redis.lrange(this.smallBatchListKey(channel), 0, -1);
    if (itemsRaw.length === 0) return;
    await this.redis.del(this.smallBatchListKey(channel));
    const items = itemsRaw.map((raw) => JSON.parse(raw) as SignalAlertInput);
    const payload = this.buildBatchPayload(channel, items);
    await sendDiscordPayloadWithRetry(payload, this.fetchFn);
  }

  private async drainRegularQueue(channel: string): Promise<void> {
    for (;;) {
      const allowed = await this.tryAcquireRateSlot(channel);
      if (!allowed) return;
      const nextRaw = await this.redis.lpop(this.regularQueueListKey(channel));
      if (!nextRaw) return;
      const next = JSON.parse(nextRaw) as SignalAlertInput;
      await this.sendSingle(next);
    }
  }

  private async tryAcquireRateSlot(channel: string): Promise<boolean> {
    const bucket = Math.floor(this.now() / this.minuteMs);
    const key = this.rateWindowKey(channel, bucket);
    const count = await this.redis.incr(key);
    if (count === 1) {
      const ttlSec = Math.max(1, Math.ceil(this.minuteMs / 1000) + 5);
      await this.redis.expire(key, ttlSec);
    }
    return count <= this.maxPerMinute;
  }

  private channelsKey(): string {
    return `${this.redisKeyPrefix}:channels`;
  }

  private smallBatchListKey(channel: string): string {
    return `${this.redisKeyPrefix}:small:${channel}`;
  }

  private regularQueueListKey(channel: string): string {
    return `${this.redisKeyPrefix}:regular:${channel}`;
  }

  private rateWindowKey(channel: string, bucket: number): string {
    return `${this.redisKeyPrefix}:rate:${channel}:${bucket}`;
  }

  private buildBatchPayload(channel: string, items: SignalAlertInput[]): Record<string, unknown> {
    const lines = items
      .slice(0, 15)
      .map((item) => `• ${item.ticker.toUpperCase()} | ${item.signal} | ${Math.round(item.score)}/100`)
      .join("\n");
    const hidden = items.length > 15 ? `\n...and ${items.length - 15} more` : "";
    return {
      username: "Stock-AI Pro Alerts",
      embeds: [
        {
          title: `🧺 Batched Signals • ${channel}`,
          description: `${lines}${hidden}`,
          color: 0x3b82f6,
          fields: [{ name: "Count", value: String(items.length), inline: true }],
          footer: { text: "Signals with score < 60 (5 min batch)" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  dispose(): void {
    // no-op: Redis-backed state
  }
}

let dispatcherSingleton: DiscordSignalAlertDispatcher | null = null;

export function getDiscordSignalAlertDispatcher(): DiscordSignalAlertDispatcher {
  if (!dispatcherSingleton) {
    dispatcherSingleton = new DiscordSignalAlertDispatcher();
  }
  return dispatcherSingleton;
}

export async function sendSignalAlertWebhook(
  ticker: string,
  signal: string,
  score: number,
  brief: string,
  meta?: SignalAlertMeta,
  fetchFn?: FetchLike,
): Promise<void> {
  if (fetchFn) {
    const payload = {
      username: "Stock-AI Pro Alerts",
      embeds: [buildEmbed(ticker, signal, score, brief, meta)],
    };
    await sendDiscordPayloadWithRetry(payload, fetchFn);
    return;
  }
  await getDiscordSignalAlertDispatcher().dispatchSignalAlert({ ticker, signal, score, brief, meta });
}
