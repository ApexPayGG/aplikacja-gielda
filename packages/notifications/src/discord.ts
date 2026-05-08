import pino from "pino";

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface DiscordSignalDlq {
  add: (name: string, payload: unknown) => Promise<unknown>;
}

export interface RadarSummaryItem {
  ticker: string;
  score: number;
}

interface SignalAlertMeta {
  confidence?: number;
  timeframe?: string;
  setup?: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "discord_webhook_notifications" },
});

function normalizeBrief(brief: string): string {
  const text = brief.trim().replace(/\s+/g, " ");
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function buildChartLink(ticker: string): string {
  return `https://www.tradingview.com/symbols/${encodeURIComponent(ticker.toUpperCase())}/`;
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

function formatPrice(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return "n/a";
  return value.toFixed(2);
}

function buildSignalEmbed(
  ticker: string,
  signal: string,
  score: number,
  brief: string,
  meta?: SignalAlertMeta,
): Record<string, unknown> {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const color = safeScore >= 75 ? 0x22c55e : safeScore >= 50 ? 0xf59e0b : 0xef4444;
  const chartLink = buildChartLink(ticker);
  const band = riskBand(safeScore);
  const emoji = signalEmoji(safeScore);
  const setup = meta?.setup ?? signal;
  const timeframe = meta?.timeframe ?? "swing (1D)";
  const confidence = meta?.confidence ?? 0;
  const confidenceText = confidence > 0 ? `${Math.max(0, Math.min(100, Math.round(confidence)))}%` : "n/a";
  return {
    title: `${emoji} ${ticker.toUpperCase()} • ${signal}`,
    description: `**AI Brief**\n${normalizeBrief(brief)}`,
    color,
    fields: [
      { name: "Ticker", value: `\`${ticker.toUpperCase()}\``, inline: true },
      { name: "Setup", value: setup, inline: true },
      { name: "Timeframe", value: timeframe, inline: true },
      { name: "Risk Score", value: `**${safeScore}/100** (${band})`, inline: true },
      { name: "Confidence", value: confidenceText, inline: true },
      {
        name: "Levels",
        value: `Entry: ${formatPrice(meta?.entry)} | SL: ${formatPrice(meta?.stopLoss)} | TP: ${formatPrice(meta?.takeProfit)}`,
        inline: false,
      },
      { name: "Chart", value: `[Open on TradingView](${chartLink})`, inline: true },
      { name: "Action", value: "Confirm setup with your strategy before entry.", inline: false },
    ],
    thumbnail: { url: "https://s3.tradingview.com/static/bundles/chart-widget-logo.svg" },
    footer: { text: "Stock-AI Pro Signal Alerts" },
    timestamp: new Date().toISOString(),
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function buildRadarSummaryEmbed(items: RadarSummaryItem[]): Record<string, unknown> {
  const top = items.slice(0, 25);
  const lines = top.map((item) => `• ${item.ticker.toUpperCase()} — ${Math.round(item.score)}/100`).join("\n");
  const hidden = items.length > 25 ? `\n...and ${items.length - 25} more` : "";
  return {
    title: "📋 Radar Summary",
    description: `${lines}${hidden}` || "No low-score signals in this window.",
    color: 0x3b82f6,
    fields: [{ name: "Signals", value: String(items.length), inline: true }],
    footer: { text: "Stock-AI Pro Signal Alerts" },
    timestamp: new Date().toISOString(),
  };
}

export class DiscordWebhookNotifier {
  private readonly webhookUrl: string | null;

  private readonly fetchFn: FetchLike;

  private readonly dlqQueue?: DiscordSignalDlq;

  constructor(params?: {
    webhookUrl?: string;
    fetchFn?: FetchLike;
    dlqQueue?: DiscordSignalDlq;
  }) {
    const envUrl = params?.webhookUrl ?? process.env.DISCORD_WEBHOOK_URL ?? "";
    this.webhookUrl = envUrl.trim() ? envUrl.trim() : null;
    this.fetchFn = params?.fetchFn ?? ((globalThis.fetch as unknown) as FetchLike);
    this.dlqQueue = params?.dlqQueue;
  }

  async sendSignalAlert(ticker: string, signal: string, score: number, brief: string, meta?: SignalAlertMeta): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug({ msg: "discord_webhook_not_configured_skip", ticker });
      return;
    }

    const payload = { embeds: [buildSignalEmbed(ticker, signal, score, brief, meta)] };
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.fetchFn(this.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.text();
          if (isRetryableStatus(res.status)) {
            throw new Error(`Discord webhook retryable ${res.status}: ${body}`);
          }
          throw new Error(`Discord webhook non-retryable ${res.status}: ${body}`);
        }

        logger.info({ msg: "discord_signal_alert_sent", ticker, signal, score });
        return;
      } catch (error) {
        lastError = error;
        logger.warn({
          msg: "discord_signal_alert_failed_attempt",
          attempt,
          ticker,
          signal,
          err: error instanceof Error ? error.message : String(error),
        });
        if (attempt < 3) {
          const delayMs = 300 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    await this.enqueueDlq({
      ticker,
      signal,
      score,
      brief,
      failedAt: new Date().toISOString(),
      err: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
  }

  async sendRadarSummary(items: RadarSummaryItem[]): Promise<void> {
    if (!this.webhookUrl || items.length === 0) return;
    const payload = { embeds: [buildRadarSummaryEmbed(items)] };
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.fetchFn(this.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          if (isRetryableStatus(res.status)) throw new Error(`Discord webhook retryable ${res.status}: ${body}`);
          throw new Error(`Discord webhook non-retryable ${res.status}: ${body}`);
        }
        logger.info({ msg: "discord_radar_summary_sent", count: items.length });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          const delayMs = 300 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    await this.enqueueDlq({
      type: "radar_summary",
      count: items.length,
      failedAt: new Date().toISOString(),
      err: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
  }

  private async enqueueDlq(payload: Record<string, unknown>): Promise<void> {
    if (!this.dlqQueue) return;
    try {
      await this.dlqQueue.add("discord:signal:failed", payload);
    } catch (error) {
      logger.error({
        msg: "discord_signal_dlq_enqueue_failed",
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
