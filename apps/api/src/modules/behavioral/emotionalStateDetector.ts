import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const MODEL = "claude-sonnet-4-20250514";
const DEFAULT_SUGGESTION = "Take a short break and breathe; calmer decisions protect your capital.";

export type EmotionalLevel = "LOW" | "MEDIUM" | "HIGH";

export type EmotionalTrackInput = {
  userId: string;
  clickRate: number;
  tradeFrequency: number;
  avgDecisionTime: number;
};

export type StressEvaluation = {
  stressDetected: boolean;
  triggerCount: number;
  triggeredBy: {
    clickRate: boolean;
    tradeFrequency: boolean;
    avgDecisionTime: boolean;
  };
};

type EmotionalEventRow = {
  userId: string;
  clickRate: number;
  tradeFrequency: number;
  avgDecisionTime: number;
  stressDetected: boolean;
  suggestion: string | null;
  createdAt: Date;
};

type DbLike = {
  emotionalEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<EmotionalEventRow>;
    findFirst: (args: Record<string, unknown>) => Promise<EmotionalEventRow | null>;
  };
};

const db = prisma as unknown as DbLike;

function clampSuggestion(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 15).join(" ");
}

export function detectStressSignals(input: EmotionalTrackInput): StressEvaluation {
  const triggeredBy = {
    clickRate: input.clickRate > 40,
    tradeFrequency: input.tradeFrequency > 5,
    avgDecisionTime: input.avgDecisionTime < 3,
  };
  const triggerCount = Object.values(triggeredBy).filter(Boolean).length;
  return {
    stressDetected: triggerCount > 0,
    triggerCount,
    triggeredBy,
  };
}

export function getEmotionalLevel(evaluation: StressEvaluation): EmotionalLevel {
  if (!evaluation.stressDetected) return "LOW";
  if (evaluation.triggerCount >= 2) return "HIGH";
  return "MEDIUM";
}

export async function suggestCalmingBreak(input: EmotionalTrackInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return DEFAULT_SUGGESTION;

  const client = new Anthropic({ apiKey });
  const prompt =
    `User shows stress signals: clickRate=${input.clickRate}/min, trades=${input.tradeFrequency}/h, ` +
    `decisionTime=${input.avgDecisionTime}s.\n` +
    "Write a calm 1-sentence suggestion to take a break. Max 15 words.";

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    const text = block?.type === "text" ? block.text : "";
    const suggestion = clampSuggestion(text);
    return suggestion || DEFAULT_SUGGESTION;
  } catch {
    return DEFAULT_SUGGESTION;
  }
}

export async function trackEmotionalState(
  input: EmotionalTrackInput,
  deps?: { db?: DbLike; suggestor?: (payload: EmotionalTrackInput) => Promise<string> },
): Promise<{ stressDetected: boolean; suggestion: string | null; level: EmotionalLevel }> {
  const database = deps?.db ?? db;
  const suggestor = deps?.suggestor ?? suggestCalmingBreak;
  const evaluation = detectStressSignals(input);
  const level = getEmotionalLevel(evaluation);
  const suggestion = evaluation.stressDetected ? await suggestor(input) : null;

  await database.emotionalEvent.create({
    data: {
      userId: input.userId,
      clickRate: input.clickRate,
      tradeFrequency: input.tradeFrequency,
      avgDecisionTime: input.avgDecisionTime,
      stressDetected: evaluation.stressDetected,
      suggestion,
    },
  });

  return { stressDetected: evaluation.stressDetected, suggestion, level };
}

export async function getEmotionalStatus(
  userId: string,
  deps?: { db?: DbLike },
): Promise<{ currentLevel: EmotionalLevel; suggestion: string | null; lastChecked: string | null }> {
  const database = deps?.db ?? db;
  const latest = await database.emotionalEvent.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    return {
      currentLevel: "LOW",
      suggestion: null,
      lastChecked: null,
    };
  }

  const evaluation = detectStressSignals({
    userId,
    clickRate: Number(latest.clickRate),
    tradeFrequency: Number(latest.tradeFrequency),
    avgDecisionTime: Number(latest.avgDecisionTime),
  });

  return {
    currentLevel: getEmotionalLevel(evaluation),
    suggestion: latest.suggestion,
    lastChecked: new Date(latest.createdAt).toISOString(),
  };
}
