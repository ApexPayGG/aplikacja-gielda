import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const MODEL = "claude-sonnet-4-20250514";
const RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH"]);

export type DailyCheckInDto = {
  id: string;
  userId: string;
  mood: number;
  plan: string | null;
  riskLevel: string | null;
  aiMessage: string | null;
  createdAt: string;
};

type CreateDailyCheckInInput = {
  userId: string;
  mood: unknown;
  plan?: string | null;
  riskLevel?: string | null;
};

function toUtcDayBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function serialize(row: {
  id: string;
  userId: string;
  mood: number;
  plan: string | null;
  riskLevel: string | null;
  aiMessage: string | null;
  createdAt: Date;
}): DailyCheckInDto {
  return {
    id: row.id,
    userId: row.userId,
    mood: row.mood,
    plan: row.plan,
    riskLevel: row.riskLevel,
    aiMessage: row.aiMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

function clampMood(value: unknown): number {
  const mood = Math.round(Number(value));
  if (!Number.isFinite(mood) || mood < 1 || mood > 5) {
    throw new Error("Mood must be an integer from 1 to 5");
  }
  return mood;
}

function normalizePlan(value: unknown): string | null {
  if (value == null) return null;
  const plan = String(value).trim();
  if (!plan) return null;
  return plan.slice(0, 200);
}

function normalizeRiskLevel(value: unknown): string | null {
  if (value == null) return null;
  const riskLevel = String(value).trim().toUpperCase();
  if (!riskLevel) return null;
  if (!RISK_LEVELS.has(riskLevel)) {
    throw new Error("riskLevel must be LOW, MEDIUM, or HIGH");
  }
  return riskLevel;
}

function defaultEncouragement(mood: number): string {
  if (mood <= 2) return "Small, disciplined steps today - your consistency builds confidence.";
  if (mood >= 4) return "Great energy today - stay selective and protect your edge.";
  return "Steady mindset today - follow your plan and trust your process.";
}

function trimToWordLimit(text: string, maxWords: number): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in model response");
  const parsed: unknown = JSON.parse(match[0]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model JSON must be an object");
  }
  return parsed as Record<string, unknown>;
}

async function buildAiMessage(input: {
  mood: number;
  plan: string | null;
  riskLevel: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return defaultEncouragement(input.mood);

  const prompt = `Trader mood: ${input.mood}/5, plan: '${input.plan ?? ""}', risk: ${input.riskLevel ?? "N/A"}.
Write one encouraging sentence (max 15 words) for their trading day.
Return JSON only: {"message":"..."}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    const json = extractJsonObject(text);
    const aiMessage = String(json.message ?? "").trim();
    if (!aiMessage) return defaultEncouragement(input.mood);
    return trimToWordLimit(aiMessage, 15);
  } catch {
    return defaultEncouragement(input.mood);
  }
}

export async function getTodayDailyCheckIn(userId: string): Promise<DailyCheckInDto | null> {
  const { start, end } = toUtcDayBounds();
  const row = await prisma.dailyCheckIn.findFirst({
    where: {
      userId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? serialize(row) : null;
}

export async function createDailyCheckInIfMissing(input: CreateDailyCheckInInput): Promise<{
  checkin: DailyCheckInDto;
  aiMessage: string;
  created: boolean;
}> {
  const userId = String(input.userId ?? "").trim();
  if (!userId) throw new Error("Missing userId");

  const mood = clampMood(input.mood);
  const plan = normalizePlan(input.plan);
  const riskLevel = normalizeRiskLevel(input.riskLevel);

  const existing = await getTodayDailyCheckIn(userId);
  if (existing) {
    if (existing.aiMessage) {
      return { checkin: existing, aiMessage: existing.aiMessage, created: false };
    }
    const aiMessage = await buildAiMessage({ mood: existing.mood, plan: existing.plan, riskLevel: existing.riskLevel });
    const updated = await prisma.dailyCheckIn.update({
      where: { id: existing.id },
      data: { aiMessage },
    });
    return { checkin: serialize(updated), aiMessage, created: false };
  }
  const aiMessage = await buildAiMessage({ mood, plan, riskLevel });
  const row = await prisma.dailyCheckIn.create({
    data: {
      userId,
      mood,
      plan,
      riskLevel,
      aiMessage,
    },
  });
  return { checkin: serialize(row), aiMessage, created: true };
}

export async function getDailyCheckInHistory(userId: string, days = 30): Promise<{
  checkins: DailyCheckInDto[];
  avgMood: number;
}> {
  const safeDays = Math.min(365, Math.max(1, Math.floor(days)));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - safeDays);

  const rows = await prisma.dailyCheckIn.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  const checkins = rows.map(serialize);
  const avgMood = checkins.length > 0 ? checkins.reduce((acc, row) => acc + row.mood, 0) / checkins.length : 0;

  return { checkins, avgMood: Number(avgMood.toFixed(2)) };
}
