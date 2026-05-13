import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const MODEL = "claude-sonnet-4-20250514";

type CreatePostTradeReflectionInput = {
  userId: string;
  tradeId: string;
  followedPlan: boolean;
  emotion?: string | null;
  lesson?: string | null;
};

function normalizeOptional(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLen);
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

function defaultInsight(input: { followedPlan: boolean; pnlPct: number; emotion: string | null }): string {
  if (!input.followedPlan && input.pnlPct < 0) {
    return "Plan break amplified loss; predefine invalidation and execute without negotiation.";
  }
  if (input.followedPlan && input.pnlPct < 0) {
    return "Process was solid despite loss; keep sizing disciplined and avoid revenge setups.";
  }
  if (input.emotion && input.emotion.toLowerCase().includes("greedy")) {
    return "Greed surfaced; lock partials at target and let only planned runner continue.";
  }
  return "Repeat what worked and document one setup cue before entering the next trade.";
}

async function buildAiInsight(input: {
  symbol: string;
  pnlPct: number;
  followedPlan: boolean;
  emotion: string | null;
  lesson: string | null;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return defaultInsight(input);

  const prompt = `Trade closed: ${input.symbol}, pnl=${input.pnlPct}%, followed_plan=${input.followedPlan},
emotion='${input.emotion ?? ""}', lesson='${input.lesson ?? ""}'.
Write one specific insight in 15 words max.
Return JSON only: {"insight":"..."}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    const json = extractJsonObject(text);
    const insight = String(json.insight ?? "").trim();
    if (!insight) return defaultInsight(input);
    return trimToWordLimit(insight, 15);
  } catch {
    return defaultInsight(input);
  }
}

export async function createPostTradeReflection(input: CreatePostTradeReflectionInput): Promise<{
  reflection: {
    id: string;
    userId: string;
    tradeId: string;
    followedPlan: boolean;
    emotion: string | null;
    lesson: string | null;
    aiInsight: string | null;
    createdAt: string;
  };
  aiInsight: string;
}> {
  const userId = String(input.userId ?? "").trim();
  const tradeId = String(input.tradeId ?? "").trim();
  if (!userId) throw new Error("Missing userId");
  if (!tradeId) throw new Error("Missing tradeId");
  if (typeof input.followedPlan !== "boolean") throw new Error("followedPlan must be boolean");

  const emotion = normalizeOptional(input.emotion, 32);
  const lesson = normalizeOptional(input.lesson, 100);

  const trade = await prisma.paperTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if (trade.userId !== userId) throw new Error("Trade does not belong to user");
  if (trade.status !== "CLOSED") throw new Error("Trade must be closed before reflection");

  const existing = await prisma.postTradeReflection.findUnique({ where: { tradeId } });
  if (existing) {
    return {
      reflection: {
        id: existing.id,
        userId: existing.userId,
        tradeId: existing.tradeId,
        followedPlan: existing.followedPlan,
        emotion: existing.emotion,
        lesson: existing.lesson,
        aiInsight: existing.aiInsight,
        createdAt: existing.createdAt.toISOString(),
      },
      aiInsight: existing.aiInsight ?? "",
    };
  }

  const aiInsight = await buildAiInsight({
    symbol: trade.ticker,
    pnlPct: Number(trade.pnlPct ?? 0),
    followedPlan: input.followedPlan,
    emotion,
    lesson,
  });

  const row = await prisma.postTradeReflection.create({
    data: {
      userId,
      tradeId,
      followedPlan: input.followedPlan,
      emotion,
      lesson,
      aiInsight,
    },
  });

  return {
    reflection: {
      id: row.id,
      userId: row.userId,
      tradeId: row.tradeId,
      followedPlan: row.followedPlan,
      emotion: row.emotion,
      lesson: row.lesson,
      aiInsight: row.aiInsight,
      createdAt: row.createdAt.toISOString(),
    },
    aiInsight,
  };
}

export async function getPostTradeReflections(userId: string, limit = 10): Promise<{
  reflections: Array<{
    id: string;
    userId: string;
    tradeId: string;
    followedPlan: boolean;
    emotion: string | null;
    lesson: string | null;
    aiInsight: string | null;
    createdAt: string;
  }>;
}> {
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) throw new Error("Missing userId");
  const take = Math.min(50, Math.max(1, Math.floor(limit) || 10));
  const rows = await prisma.postTradeReflection.findMany({
    where: { userId: safeUserId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return {
    reflections: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      tradeId: row.tradeId,
      followedPlan: row.followedPlan,
      emotion: row.emotion,
      lesson: row.lesson,
      aiInsight: row.aiInsight,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
