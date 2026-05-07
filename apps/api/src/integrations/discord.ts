import pino from "pino";

type DiscordChannelKey = "signals_gpw" | "signals_us" | "paper_trading" | "results" | "vip_signals";

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export class DiscordBot {
  private readonly token: string;

  private readonly guildId: string;

  private readonly channelIds: Record<DiscordChannelKey, string>;

  private readonly fetchFn: FetchLike;

  private readonly logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { scope: "discord_bot" },
  });

  constructor(
    botToken: string,
    guildId: string,
    channelIds: Record<DiscordChannelKey, string>,
    fetchFn?: FetchLike,
  ) {
    const token = botToken?.trim();
    if (!token) {
      throw new Error("Discord botToken is required");
    }
    this.token = token;
    this.guildId = guildId;
    this.channelIds = channelIds;
    this.fetchFn = fetchFn ?? ((globalThis.fetch as unknown) as FetchLike);
  }

  async sendSignal(
    channel: "signals_gpw" | "signals_us",
    signal: {
      ticker: string;
      score: number;
      brief_pl: string;
      pattern: string;
      confidence: number;
    },
  ): Promise<void> {
    const color = signal.score > 70 ? 0x22c55e : signal.score >= 50 ? 0xeab308 : 0xef4444;
    const embed = {
      title: `${signal.ticker} | ${signal.pattern}`,
      description: signal.brief_pl.slice(0, 300),
      color,
      fields: [
        { name: "Score", value: String(signal.score), inline: true },
        { name: "Pattern", value: signal.pattern, inline: true },
        { name: "Confidence", value: `${signal.confidence}%`, inline: true },
      ],
    };
    await this.sendToChannel(channel, { embeds: [embed] }, "sendSignal");
  }

  async sendPaperTradeUpdate(
    userId: string,
    trade: {
      ticker: string;
      side: "BUY" | "SELL";
      quantity: number;
      price: number;
      pnl_pct?: number;
    },
  ): Promise<void> {
    const sideWord = trade.side === "BUY" ? "bought" : "sold";
    let text = `User ${userId} ${sideWord} ${trade.quantity} ${trade.ticker} @ $${trade.price}`;
    if (trade.side === "SELL" && trade.pnl_pct !== undefined) {
      const sign = trade.pnl_pct >= 0 ? "+" : "";
      text = `User ${userId} sold ${trade.quantity} ${trade.ticker} @ $${trade.price} (${sign}${trade.pnl_pct.toFixed(1)}%)`;
    }
    await this.sendToChannel("paper_trading", { content: text }, "sendPaperTradeUpdate");
  }

  async sendWeeklyResults(stats: {
    total_signals: number;
    win_rate: number;
    avg_return: number;
  }): Promise<void> {
    const sign = stats.avg_return >= 0 ? "+" : "";
    const text = `Weekly: ${stats.total_signals} signals, ${stats.win_rate}% win rate, ${sign}${stats.avg_return}% avg`;
    await this.sendToChannel("results", { content: text }, "sendWeeklyResults");
  }

  private async sendToChannel(channelKey: DiscordChannelKey, payload: Record<string, unknown>, op: string): Promise<void> {
    const channelId = this.channelIds[channelKey];
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.fetchFn(url, {
          method: "POST",
          headers: {
            Authorization: `Bot ${this.token}`,
            "Content-Type": "application/json",
            "X-Guild-Id": this.guildId,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Discord API ${res.status}: ${body}`);
        }
        this.logger.info({ msg: "discord_message_sent", op, channel: channelKey });
        return;
      } catch (error) {
        lastErr = error;
        this.logger.error({
          msg: "discord_send_failed",
          op,
          attempt,
          channel: channelKey,
          err: error instanceof Error ? error.message : String(error),
        });
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
        }
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

function parseChannelIdsFromEnv(): Record<DiscordChannelKey, string> {
  return {
    signals_gpw: process.env.DISCORD_CHANNEL_SIGNALS_GPW ?? "",
    signals_us: process.env.DISCORD_CHANNEL_SIGNALS_US ?? "",
    paper_trading: process.env.DISCORD_CHANNEL_PAPER_TRADING ?? "",
    results: process.env.DISCORD_CHANNEL_RESULTS ?? "",
    vip_signals: process.env.DISCORD_CHANNEL_VIP_SIGNALS ?? "",
  };
}

function createNoopDiscordBot(): Pick<DiscordBot, "sendSignal" | "sendPaperTradeUpdate" | "sendWeeklyResults"> {
  return {
    sendSignal: async () => undefined,
    sendPaperTradeUpdate: async () => undefined,
    sendWeeklyResults: async () => undefined,
  };
}

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim() ?? "";

export const discordBot: Pick<DiscordBot, "sendSignal" | "sendPaperTradeUpdate" | "sendWeeklyResults"> =
  token && guildId ? new DiscordBot(token, guildId, parseChannelIdsFromEnv()) : createNoopDiscordBot();
