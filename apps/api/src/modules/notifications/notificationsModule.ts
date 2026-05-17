import { prisma } from "../../db/index";

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export interface NotificationSignalPayload {
  ticker: string;
  setupType: string;
  riskScore: number;
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  winRate?: number | null;
}

export interface UserNotificationPreferences {
  discordWebhook: string | null;
  telegramChatId: string | null;
  notifySignals: boolean;
  notifyDividends: boolean;
  minSignalScore: number;
}

export interface NotificationPreferencesUpdateInput {
  discordWebhook?: string | null;
  telegramChatId?: string | null;
  notifySignals?: boolean;
  notifyDividends?: boolean;
  minSignalScore?: number;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface DiscordSignalEmbed {
  title: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp: string;
}

export interface NotificationDeliveryResult {
  discordSent: boolean;
  telegramSent: boolean;
}

export interface NotificationCenterItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
}

export interface NotificationsListResponse {
  notifications: NotificationCenterItem[];
  unreadCount: number;
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
}

interface UserPreferencesRow {
  id: string;
  discordWebhook: string | null;
  telegramChatId: string | null;
  notifySignals: boolean | null;
  notifyDividends: boolean | null;
  minSignalScore: number | null;
}

interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
}

type DbLike = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: boolean;
        discordWebhook: boolean;
        telegramChatId: boolean;
        notifySignals: boolean;
        notifyDividends: boolean;
        minSignalScore: boolean;
      };
    }) => Promise<UserPreferencesRow | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
      select: {
        id: boolean;
        discordWebhook: boolean;
        telegramChatId: boolean;
        notifySignals: boolean;
        notifyDividends: boolean;
        minSignalScore: boolean;
      };
    }) => Promise<UserPreferencesRow>;
  };
  notification: {
    findMany: (args: {
      where: { userId: string };
      orderBy: { createdAt: "desc" | "asc" };
      take: number;
    }) => Promise<NotificationRow[]>;
    count: (args: { where: { userId: string; read?: boolean } }) => Promise<number>;
    updateMany: (args: { where: { userId?: string; read?: boolean }; data: { read: boolean } }) => Promise<{ count: number }>;
    update: (args: { where: { id: string }; data: { read: boolean } }) => Promise<NotificationRow>;
  };
};

const db = prisma as unknown as DbLike;
const BRAND_DARK_COLOR = 0x2d0a6b;

function normalizeUserId(userId: string): string {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) throw new Error("Missing userId");
  return safeUserId;
}

function normalizeNotificationId(notificationId: string): string {
  const safeNotificationId = String(notificationId ?? "").trim();
  if (!safeNotificationId) throw new Error("Missing notificationId");
  return safeNotificationId;
}

function normalizeLimit(limitInput: unknown): number {
  if (limitInput == null || limitInput === "") return 20;
  const parsed = Number(limitInput);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid notifications limit");
  return Math.min(parsed, 100);
}

function clampSignalScore(score: number): number {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 70;
  return Math.max(50, Math.min(100, Math.round(numericScore)));
}

function normalizeDiscordWebhook(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const valid =
    trimmed.startsWith("https://discord.com/api/webhooks/") ||
    trimmed.startsWith("https://discordapp.com/api/webhooks/");
  if (!valid) throw new Error("Invalid Discord webhook URL");
  return trimmed;
}

function normalizeTelegramChatId(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function toPrefs(row: UserPreferencesRow): UserNotificationPreferences {
  return {
    discordWebhook: normalizeDiscordWebhook(row.discordWebhook),
    telegramChatId: normalizeTelegramChatId(row.telegramChatId),
    notifySignals: row.notifySignals ?? true,
    notifyDividends: row.notifyDividends ?? true,
    minSignalScore: clampSignalScore(row.minSignalScore ?? 70),
  };
}

function toNotificationItem(row: NotificationRow): NotificationCenterItem {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    link: row.link,
    createdAt: row.createdAt,
  };
}

function formatPrice(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return Number(value).toFixed(2);
}

function formatPercent(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "n/a";
  return `${Number(value).toFixed(1)}%`;
}

function scoreValue(score: number): number {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.max(0, Math.min(100, Math.round(numericScore)));
}

async function postJson(
  url: string,
  payload: Record<string, unknown>,
  fetchFn: FetchLike,
): Promise<boolean> {
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return true;
    await response.text();
    return false;
  } catch {
    return false;
  }
}

function preferencesSelect() {
  return {
    id: true,
    discordWebhook: true,
    telegramChatId: true,
    notifySignals: true,
    notifyDividends: true,
    minSignalScore: true,
  } as const;
}

export async function getNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
  const safeUserId = normalizeUserId(userId);
  const row = await db.user.findUnique({
    where: { id: safeUserId },
    select: preferencesSelect(),
  });
  if (!row) throw new Error("User not found");
  return toPrefs(row);
}

export async function updateNotificationPreferences(
  userId: string,
  input: NotificationPreferencesUpdateInput,
): Promise<UserNotificationPreferences> {
  const safeUserId = normalizeUserId(userId);
  const data: Record<string, unknown> = {};

  if ("discordWebhook" in input) {
    data.discordWebhook = normalizeDiscordWebhook(input.discordWebhook);
  }
  if ("telegramChatId" in input) {
    data.telegramChatId = normalizeTelegramChatId(input.telegramChatId);
  }
  if ("notifySignals" in input && typeof input.notifySignals === "boolean") {
    data.notifySignals = input.notifySignals;
  }
  if ("notifyDividends" in input && typeof input.notifyDividends === "boolean") {
    data.notifyDividends = input.notifyDividends;
  }
  if ("minSignalScore" in input) {
    data.minSignalScore = clampSignalScore(Number(input.minSignalScore));
  }

  if (Object.keys(data).length === 0) {
    return getNotificationPreferences(safeUserId);
  }

  const updated = await db.user.update({
    where: { id: safeUserId },
    data,
    select: preferencesSelect(),
  });
  return toPrefs(updated);
}

export async function getUserNotifications(
  userId: string,
  limitInput?: number,
): Promise<NotificationsListResponse> {
  const safeUserId = normalizeUserId(userId);
  const safeLimit = normalizeLimit(limitInput);
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: safeUserId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    }),
    db.notification.count({
      where: { userId: safeUserId, read: false },
    }),
  ]);

  return {
    notifications: rows.map(toNotificationItem),
    unreadCount,
  };
}

export async function markAllNotificationsAsRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
  const safeUserId = normalizeUserId(userId);
  const result = await db.notification.updateMany({
    where: { userId: safeUserId, read: false },
    data: { read: true },
  });
  return { updatedCount: result.count };
}

export async function markNotificationAsRead(notificationId: string): Promise<NotificationCenterItem> {
  const safeNotificationId = normalizeNotificationId(notificationId);
  try {
    const row = await db.notification.update({
      where: { id: safeNotificationId },
      data: { read: true },
    });
    return toNotificationItem(row);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) {
      throw new Error("Notification not found");
    }
    throw error;
  }
}

export function buildDiscordSignalEmbed(signal: NotificationSignalPayload): DiscordSignalEmbed {
  const safeTicker = String(signal.ticker ?? "").trim().toUpperCase() || "N/A";
  const safeSetupType = String(signal.setupType ?? "").trim() || "Signal";
  const safeScore = scoreValue(signal.riskScore);
  return {
    title: `${safeTicker} — ${safeSetupType} | Score: ${safeScore}`,
    color: BRAND_DARK_COLOR,
    fields: [
      { name: "Entry", value: formatPrice(signal.entry), inline: true },
      { name: "SL", value: formatPrice(signal.stopLoss), inline: true },
      { name: "TP", value: formatPrice(signal.takeProfit), inline: true },
      { name: "Win Rate", value: formatPercent(signal.winRate), inline: true },
    ],
    footer: { text: "StockAI Pro" },
    timestamp: new Date().toISOString(),
  };
}

export function buildTelegramSignalMessage(signal: NotificationSignalPayload): string {
  const safeTicker = String(signal.ticker ?? "").trim().toUpperCase() || "N/A";
  const safeSetupType = String(signal.setupType ?? "").trim() || "Signal";
  const safeScore = scoreValue(signal.riskScore);
  return [
    "📈 StockAI Pro Alert",
    `${safeTicker} — ${safeSetupType}`,
    `📊 Score: ${safeScore}`,
    `🎯 Entry: ${formatPrice(signal.entry)}`,
    `🛡️ SL: ${formatPrice(signal.stopLoss)}`,
    `🏁 TP: ${formatPrice(signal.takeProfit)}`,
    `✅ Win Rate: ${formatPercent(signal.winRate)}`,
  ].join("\n");
}

export async function sendSignalAlert(
  signal: NotificationSignalPayload,
  userPreferences: UserNotificationPreferences,
  options?: {
    fetchFn?: FetchLike;
    telegramBotToken?: string;
  },
): Promise<NotificationDeliveryResult> {
  if (!userPreferences.notifySignals) {
    return { discordSent: false, telegramSent: false };
  }

  const safeScore = scoreValue(signal.riskScore);
  if (safeScore < clampSignalScore(userPreferences.minSignalScore)) {
    return { discordSent: false, telegramSent: false };
  }

  const fetchFn = options?.fetchFn ?? ((globalThis.fetch as unknown) as FetchLike);
  let discordSent = false;
  let telegramSent = false;

  if (userPreferences.discordWebhook) {
    const discordPayload = {
      username: "StockAI Pro",
      embeds: [buildDiscordSignalEmbed(signal)],
    };
    discordSent = await postJson(userPreferences.discordWebhook, discordPayload, fetchFn);
  }

  const telegramToken = options?.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (telegramToken && userPreferences.telegramChatId) {
    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const telegramPayload = {
      chat_id: userPreferences.telegramChatId,
      text: buildTelegramSignalMessage(signal),
      disable_web_page_preview: true,
    };
    telegramSent = await postJson(telegramUrl, telegramPayload, fetchFn);
  }

  return { discordSent, telegramSent };
}

export async function sendSignalTestNotification(userId: string): Promise<NotificationDeliveryResult> {
  const prefs = await getNotificationPreferences(userId);
  const sampleScore = Math.max(75, prefs.minSignalScore);
  return sendSignalAlert(
    {
      ticker: "TEST",
      setupType: "Test Notification",
      riskScore: sampleScore,
      entry: 100,
      stopLoss: 95,
      takeProfit: 108,
      winRate: 62,
    },
    prefs,
  );
}
