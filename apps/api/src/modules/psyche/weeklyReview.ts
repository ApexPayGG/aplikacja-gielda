import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const MODEL = "claude-sonnet-4-20250514";

export type WeeklyReviewAnswers = {
  q1: number;
  q2: number;
  q3: number;
  q4: string;
  q5: string;
};

export type WeeklyReviewDto = {
  id: string;
  userId: string;
  weekStart: string;
  answers: WeeklyReviewAnswers;
  aiLetter: string | null;
  growthScore: number | null;
  createdAt: string;
};

type CreateWeeklyReviewInput = {
  userId: string;
  q1: unknown;
  q2: unknown;
  q3: unknown;
  q4: unknown;
  q5: unknown;
};

function startOfUtcWeek(now = new Date()): Date {
  const day = now.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  d.setUTCDate(d.getUTCDate() - delta);
  return d;
}

function parseRating(value: unknown, label: string): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(`${label} must be an integer from 1 to 5`);
  }
  return n;
}

function parseText(value: unknown, label: string, maxLen = 1000): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text.slice(0, maxLen);
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

function defaultLetter(answers: WeeklyReviewAnswers): string {
  const positive = answers.q1 + answers.q3;
  const pressure = answers.q2;
  if (positive >= 8 && pressure <= 2) {
    return "You showed strong discipline this week and respected your process. Keep reinforcing what worked, especially your execution around stops. Next week, stay selective and keep that same calm consistency.";
  }
  if (pressure >= 4) {
    return "You showed effort, but overtrading pressure was visible this week. Treat this as useful feedback and tighten your entry criteria before each trade. Next week, focus on fewer, higher-conviction setups and protect your capital first.";
  }
  return "You are building progress through reflection and honest review. Keep your rules visible and make your stop-loss discipline non-negotiable in every setup. Next week, commit to one concrete behavior change and track it daily.";
}

function computeGrowthScore(answers: WeeklyReviewAnswers): number {
  const positive = answers.q1 + answers.q3 + (6 - answers.q2);
  return Math.round((positive / 15) * 100);
}

function toAnswers(input: CreateWeeklyReviewInput): WeeklyReviewAnswers {
  return {
    q1: parseRating(input.q1, "q1"),
    q2: parseRating(input.q2, "q2"),
    q3: parseRating(input.q3, "q3"),
    q4: parseText(input.q4, "q4"),
    q5: parseText(input.q5, "q5"),
  };
}

async function buildAiLetter(answers: WeeklyReviewAnswers): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return defaultLetter(answers);

  const prompt = `Trader weekly answers: discipline=${answers.q1}/5, overtrading=${answers.q2}/5,
 stop_loss=${answers.q3}/5, lesson='${answers.q4}', next_week='${answers.q5}'.
 Write a personal growth letter, 3 sentences max,
 encouraging but honest. Address as 'you'.
 Return JSON only: {"letter":"..."}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 220,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    const json = extractJsonObject(text);
    const letter = String(json.letter ?? "").trim();
    if (!letter) return defaultLetter(answers);
    return letter;
  } catch {
    return defaultLetter(answers);
  }
}

function serialize(row: {
  id: string;
  userId: string;
  weekStart: Date;
  answers: unknown;
  aiLetter: string | null;
  growthScore: number | null;
  createdAt: Date;
}): WeeklyReviewDto {
  const raw = row.answers as Partial<WeeklyReviewAnswers> | null;
  return {
    id: row.id,
    userId: row.userId,
    weekStart: row.weekStart.toISOString(),
    answers: {
      q1: Number(raw?.q1 ?? 1),
      q2: Number(raw?.q2 ?? 1),
      q3: Number(raw?.q3 ?? 1),
      q4: String(raw?.q4 ?? ""),
      q5: String(raw?.q5 ?? ""),
    },
    aiLetter: row.aiLetter,
    growthScore: row.growthScore,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCurrentWeeklyReview(userId: string): Promise<WeeklyReviewDto | null> {
  const weekStart = startOfUtcWeek();
  const row = await prisma.weeklyReview.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
  });
  return row ? serialize(row) : null;
}

export async function createWeeklyReview(input: CreateWeeklyReviewInput): Promise<{
  review: WeeklyReviewDto;
  letter: string;
}> {
  const userId = String(input.userId ?? "").trim();
  if (!userId) throw new Error("Missing userId");

  const answers = toAnswers(input);
  const growthScore = computeGrowthScore(answers);
  const letter = await buildAiLetter(answers);
  const weekStart = startOfUtcWeek();

  const row = await prisma.weeklyReview.upsert({
    where: {
      userId_weekStart: {
        userId,
        weekStart,
      },
    },
    update: {
      answers,
      aiLetter: letter,
      growthScore,
    },
    create: {
      userId,
      weekStart,
      answers,
      aiLetter: letter,
      growthScore,
    },
  });

  return { review: serialize(row), letter };
}

export async function getWeeklyReviewHistory(userId: string, weeks = 8): Promise<{ reviews: WeeklyReviewDto[] }> {
  const safeWeeks = Math.min(52, Math.max(1, Math.floor(weeks)));
  const rows = await prisma.weeklyReview.findMany({
    where: { userId },
    orderBy: { weekStart: "desc" },
    take: safeWeeks,
  });
  return { reviews: rows.map(serialize) };
}
