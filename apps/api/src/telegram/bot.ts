import type TelegramBot from "node-telegram-bot-api";
import { analyzeStock } from "../ai/analysis";
import { getCompanyBySymbol, searchCompanies } from "../db/company-queries";
import { getCacheRedis } from "../redis";
import type { TelegramMessage } from "../types/scraper.types";
const TG_CHUNK = 4000;

/** Map raw Telegram update payload to our `TelegramMessage` shape (for tests / future routing). */
export function toTelegramMessage(msg: TelegramBot.Message): TelegramMessage {
  return {
    message_id: msg.message_id,
    chat: { id: msg.chat.id, type: msg.chat.type },
    from: msg.from
      ? {
          id: msg.from.id,
          is_bot: msg.from.is_bot,
          first_name: msg.from.first_name,
          username: msg.from.username,
        }
      : undefined,
    text: msg.text,
    date: msg.date,
  };
}
const ALERT_KEY_PREFIX = "telegram:alerts:";

const memoryAlerts = new Map<string, Set<number>>();

function chunkText(text: string, maxLen = TG_CHUNK): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    parts.push(text.slice(i, i + maxLen));
  }
  return parts;
}

async function resolveSymbol(raw: string): Promise<string | null> {
  const q = raw.trim().toUpperCase();
  if (!q) return null;
  const exact = await getCompanyBySymbol(q);
  if (exact) return exact.symbol;
  const hits = await searchCompanies(q, 5);
  if (hits.length === 0) return null;
  return hits[0].symbol;
}

async function subscribeToAlerts(chatId: number, symbol: string): Promise<void> {
  const sym = symbol.toUpperCase();
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const redis = getCacheRedis();
      await redis.sadd(`${ALERT_KEY_PREFIX}${sym}`, String(chatId));
      return;
    } catch (e) {
      console.warn("[telegram] Redis subscribe failed, using memory:", e instanceof Error ? e.message : e);
    }
  }
  let set = memoryAlerts.get(sym);
  if (!set) {
    set = new Set();
    memoryAlerts.set(sym, set);
  }
  set.add(chatId);
}

function welcomeText(): string {
  return [
    "StockAI Pro — bot",
    "",
    "Commands:",
    "/start — this help",
    "/search <symbol|name> — company + AI brief (PL + EN)",
    "/alert <symbol> — subscribe to price/news alerts for a symbol (prototype)",
  ].join("\n");
}

export async function sendAnalysisBrief(bot: TelegramBot, chatId: number, symbol: string): Promise<void> {
  const sym = symbol.toUpperCase();
  const { brief } = await analyzeStock(sym, "pl");
  const header = `${sym} — AI brief (PL + EN)\n\n`;
  const body = `${header}${brief}`;
  for (const part of chunkText(body)) {
    await bot.sendMessage(chatId, part);
  }
}

export function registerTelegramHandlers(bot: TelegramBot): void {
  bot.onText(/^\/start(?:\s|$)/i, async (msg) => {
    await bot.sendMessage(msg.chat.id, welcomeText());
  });

  bot.onText(/^\/search(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const arg = (match?.[1] ?? "").trim();
    if (!arg) {
      await bot.sendMessage(msg.chat.id, "Usage: /search <symbol or company name>");
      return;
    }
    try {
      const sym = await resolveSymbol(arg);
      if (!sym) {
        await bot.sendMessage(msg.chat.id, `No company found for "${arg}" in the database.`);
        return;
      }
      const company = await getCompanyBySymbol(sym);
      const lines = [
        `${company?.symbol ?? sym} — ${company?.name ?? sym}`,
        company ? `Sector: ${company.sector}` : "",
        "",
      ].filter(Boolean);
      await bot.sendMessage(msg.chat.id, lines.join("\n"));
      await sendAnalysisBrief(bot, msg.chat.id, sym);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      await bot.sendMessage(msg.chat.id, `Search failed: ${m}`);
    }
  });

  bot.onText(/^\/search(?:@\w+)?\s*$/i, async (msg) => {
    await bot.sendMessage(msg.chat.id, "Usage: /search <symbol or company name>");
  });

  bot.onText(/^\/alert(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
    const arg = (match?.[1] ?? "").trim();
    if (!arg) {
      await bot.sendMessage(msg.chat.id, "Usage: /alert <symbol>");
      return;
    }
    try {
      const sym = await resolveSymbol(arg);
      if (!sym) {
        await bot.sendMessage(msg.chat.id, `Unknown symbol/name "${arg}". Add the company to the DB first.`);
        return;
      }
      await subscribeToAlerts(msg.chat.id, sym);
      await bot.sendMessage(
        msg.chat.id,
        `You are subscribed to alerts for ${sym}. (Delivery pipeline not wired yet — subscription stored.)`,
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      await bot.sendMessage(msg.chat.id, `Alert subscribe failed: ${m}`);
    }
  });

  bot.onText(/^\/alert(?:@\w+)?\s*$/i, async (msg) => {
    await bot.sendMessage(msg.chat.id, "Usage: /alert <symbol>");
  });
}
