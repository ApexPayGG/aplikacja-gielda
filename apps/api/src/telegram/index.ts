import process from "node:process";
import TelegramBot from "node-telegram-bot-api";
import { registerTelegramHandlers } from "./bot";

let botInstance: TelegramBot | null = null;

/**
 * Starts long-polling Telegram bot when `TELEGRAM_BOT_TOKEN` is set; otherwise logs and returns.
 */
export async function startTelegramBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set; bot disabled.");
    return;
  }

  if (botInstance) {
    console.warn("[telegram] Bot already running.");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  registerTelegramHandlers(bot);

  bot.on("polling_error", (err: Error) => {
    console.error("[telegram] polling_error", err.message);
  });

  console.log("[telegram] Bot polling started.");
}

export function stopTelegramBot(): void {
  if (!botInstance) return;
  try {
    botInstance.stopPolling({ cancel: true });
  } catch (e) {
    console.warn("[telegram] stopPolling:", e instanceof Error ? e.message : e);
  }
  botInstance = null;
  console.log("[telegram] Bot stopped.");
}
