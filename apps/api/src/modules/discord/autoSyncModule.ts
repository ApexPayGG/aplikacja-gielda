import { prisma } from "../../db/index";

type UserSettingsStore = {
  findUnique: (args: {
    where: { userId: string };
    select?: { discordWebhook?: boolean };
  }) => Promise<{ discordWebhook: string | null } | null>;
  upsert: (args: {
    where: { userId: string };
    create: { userId: string; discordWebhook: string | null };
    update: { discordWebhook: string | null };
  }) => Promise<{ id: string }>;
};

type DbLike = {
  userSettings: UserSettingsStore;
};

const db = prisma as unknown as DbLike;
const hasDiscordInfra = Boolean(process.env.DISCORD_BOT_TOKEN?.trim());

function normalizeUserId(userId: string): string {
  const next = String(userId ?? "").trim();
  if (!next) throw new Error("Missing userId");
  return next;
}

function normalizeWebhookUrl(webhookUrl: string): string {
  const next = String(webhookUrl ?? "").trim();
  if (!next) throw new Error("Missing webhookUrl");
  const allowed =
    next.startsWith("https://discord.com/api/webhooks/") ||
    next.startsWith("https://discordapp.com/api/webhooks/");
  if (!allowed) throw new Error("Invalid Discord webhook URL");
  return next;
}

function toFixed(value: number, digits = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function formatHoldingDays(entryAt: Date | string, exitAt: Date | string): number {
  const entry = new Date(entryAt);
  const exit = new Date(exitAt);
  if (Number.isNaN(entry.getTime()) || Number.isNaN(exit.getTime())) return 0;
  const diff = Math.max(0, exit.getTime() - entry.getTime());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function buildDiscordOpenMessage(input: {
  symbol: string;
  price: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
}): string {
  const sl = input.stopLoss == null ? "n/a" : toFixed(input.stopLoss);
  const tp = input.takeProfit == null ? "n/a" : toFixed(input.takeProfit);
  return [
    "📈 **Otworzyłem pozycję**",
    `Symbol: ${input.symbol} | Cena: ${toFixed(input.price)}`,
    `Stop Loss: ${sl} | Take Profit: ${tp}`,
    "via StockAI Pro 🤖",
  ].join("\n");
}

export function buildDiscordCloseMessage(input: {
  symbol: string;
  pnlPct: number;
  holdingDays: number;
}): string {
  return [
    "📊 **Zamknąłem pozycję**",
    `Symbol: ${input.symbol} | Wynik: ${toFixed(input.pnlPct)}%`,
    `Czas trzymania: ${Math.max(0, Math.round(input.holdingDays))} dni`,
    "via StockAI Pro 🤖",
  ].join("\n");
}

export async function saveDiscordWebhook(userId: string, webhookUrl: string): Promise<boolean> {
  const safeUserId = normalizeUserId(userId);
  const safeWebhook = normalizeWebhookUrl(webhookUrl);
  await db.userSettings.upsert({
    where: { userId: safeUserId },
    create: { userId: safeUserId, discordWebhook: safeWebhook },
    update: { discordWebhook: safeWebhook },
  });
  return true;
}

export async function getDiscordWebhook(userId: string): Promise<string | null> {
  const safeUserId = normalizeUserId(userId);
  const row = await db.userSettings.findUnique({
    where: { userId: safeUserId },
    select: { discordWebhook: true },
  });
  const webhookUrl = row?.discordWebhook?.trim() ?? "";
  return webhookUrl || null;
}

export async function sendDiscordWebhookMessage(webhookUrl: string, content: string): Promise<boolean> {
  if (!hasDiscordInfra) return false;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.ok;
}

export async function sendDiscordTest(userId: string): Promise<boolean> {
  const webhookUrl = await getDiscordWebhook(userId);
  if (!webhookUrl) return false;
  const content = ["🧪 **Test webhooka**", "Połączenie działa poprawnie.", "via StockAI Pro 🤖"].join("\n");
  return sendDiscordWebhookMessage(webhookUrl, content);
}

export async function sendDiscordOpen(input: {
  userId: string;
  symbol: string;
  price: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
}): Promise<boolean> {
  const webhookUrl = await getDiscordWebhook(input.userId);
  if (!webhookUrl) return false;
  const content = buildDiscordOpenMessage(input);
  return sendDiscordWebhookMessage(webhookUrl, content);
}

export async function sendDiscordClose(input: {
  userId: string;
  symbol: string;
  pnlPct: number;
  entryAt: Date | string;
  exitAt: Date | string;
}): Promise<boolean> {
  const webhookUrl = await getDiscordWebhook(input.userId);
  if (!webhookUrl) return false;
  const content = buildDiscordCloseMessage({
    symbol: input.symbol,
    pnlPct: input.pnlPct,
    holdingDays: formatHoldingDays(input.entryAt, input.exitAt),
  });
  return sendDiscordWebhookMessage(webhookUrl, content);
}
