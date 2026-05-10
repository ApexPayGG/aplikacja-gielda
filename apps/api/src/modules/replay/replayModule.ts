import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/index";

const REPLAY_MODEL = "claude-sonnet-4-20250514";

export type ReplayAction = "BUY" | "SELL";

export type ReplaySnapshot = {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  priceChange5d: number;
};

export type ReplayEvaluationResult = {
  score: number;
  explanation: string;
  actualOutcome: number;
};

type QuoteRow = {
  symbol: string;
  timestamp: Date;
  open: Prisma.Decimal;
  high: Prisma.Decimal;
  low: Prisma.Decimal;
  close: Prisma.Decimal;
  volume: bigint;
};

type DbLike = {
  quote: {
    findFirst: (args: Record<string, unknown>) => Promise<QuoteRow | null>;
  };
};

function toUtcDayBounds(dateInput: string): { start: Date; end: Date; yyyyMmDd: string } {
  const date = String(dateInput ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must use YYYY-MM-DD format");
  }
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid date");
  }
  return { start, end, yyyyMmDd: date };
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toNum(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function toRoundedPercent(value: number): number {
  return Number(value.toFixed(2));
}

function parseClaudeJson(raw: string): { score: number; explanation: string } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : raw;
  const parsed = JSON.parse(payload) as { score?: unknown; explanation?: unknown };

  const scoreNum = Number(parsed.score);
  const score = Number.isFinite(scoreNum) ? Math.max(1, Math.min(10, Math.round(scoreNum))) : 1;
  const explanation = String(parsed.explanation ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return {
    score,
    explanation: explanation || "Decision quality could not be assessed.",
  };
}

function buildReplayPrompt(params: {
  action: ReplayAction;
  symbol: string;
  price: number;
  date: string;
  actualChange: number;
}): string {
  return (
    `User decided to ${params.action} ${params.symbol} at ${params.price} on ${params.date}. ` +
    `Actual outcome after 5 days: ${params.actualChange}%. ` +
    "Rate the decision 1-10 and explain in 2 sentences.\n" +
    "Return JSON only: { score: number, explanation: string }"
  );
}

export function createReplayService(customDb?: DbLike) {
  const db = customDb ?? (prisma as unknown as DbLike);

  async function loadSnapshotAndFuture(symbolInput: string, dateInput: string): Promise<{
    snapshot: QuoteRow;
    future: QuoteRow;
    date: string;
  }> {
    const symbol = String(symbolInput ?? "").trim().toUpperCase();
    if (!symbol) throw new Error("Missing symbol");

    const { start, end, yyyyMmDd } = toUtcDayBounds(dateInput);

    const snapshot = await db.quote.findFirst({
      where: { symbol, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: "asc" },
    });
    if (!snapshot) {
      throw new Error(`No historical quote found for ${symbol} on ${yyyyMmDd}`);
    }

    const dayPlus5 = shiftDays(start, 5);
    const future = await db.quote.findFirst({
      where: { symbol, timestamp: { gte: dayPlus5 } },
      orderBy: { timestamp: "asc" },
    });
    if (!future) {
      throw new Error(`No quote found for ${symbol} at least 5 days after ${yyyyMmDd}`);
    }

    return { snapshot, future, date: yyyyMmDd };
  }

  async function getSnapshot(symbol: string, date: string): Promise<ReplaySnapshot> {
    const { snapshot, future, date: yyyyMmDd } = await loadSnapshotAndFuture(symbol, date);

    const close = toNum(snapshot.close);
    const futureClose = toNum(future.close);
    const changePct = close === 0 ? 0 : ((futureClose - close) / close) * 100;

    return {
      symbol: snapshot.symbol.toUpperCase(),
      date: yyyyMmDd,
      open: toNum(snapshot.open),
      high: toNum(snapshot.high),
      low: toNum(snapshot.low),
      close,
      volume: Number(snapshot.volume),
      priceChange5d: toRoundedPercent(changePct),
    };
  }

  async function evaluateDecision(input: {
    userId: string;
    symbol: string;
    date: string;
    action: ReplayAction;
    price: number;
  }): Promise<ReplayEvaluationResult> {
    const symbol = String(input.symbol ?? "").trim().toUpperCase();
    const userId = String(input.userId ?? "").trim();
    const action = input.action;
    const price = Number(input.price);
    if (!userId) throw new Error("Missing userId");
    if (!symbol) throw new Error("Missing symbol");
    if (action !== "BUY" && action !== "SELL") throw new Error("action must be BUY or SELL");
    if (!Number.isFinite(price) || price <= 0) throw new Error("price must be a positive number");

    const { snapshot, future } = await loadSnapshotAndFuture(symbol, input.date);
    const close = toNum(snapshot.close);
    const futureClose = toNum(future.close);
    const actualChange = close === 0 ? 0 : ((futureClose - close) / close) * 100;

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set. Replay evaluate requires Claude.");
    }

    const prompt = buildReplayPrompt({
      action,
      symbol,
      price,
      date: input.date,
      actualChange: toRoundedPercent(actualChange),
    });
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: REPLAY_MODEL,
      max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    });
    const content = msg.content[0];
    const text = content?.type === "text" ? content.text : "";
    const parsed = parseClaudeJson(text);

    return {
      score: parsed.score,
      explanation: parsed.explanation,
      actualOutcome: toRoundedPercent(actualChange),
    };
  }

  return { getSnapshot, evaluateDecision };
}

let replayServiceSingleton: ReturnType<typeof createReplayService> | null = null;

function getReplayService() {
  if (!replayServiceSingleton) {
    replayServiceSingleton = createReplayService();
  }
  return replayServiceSingleton;
}

export async function getReplaySnapshot(symbol: string, date: string): Promise<ReplaySnapshot> {
  return getReplayService().getSnapshot(symbol, date);
}

export async function evaluateReplayDecision(input: {
  userId: string;
  symbol: string;
  date: string;
  action: ReplayAction;
  price: number;
}): Promise<ReplayEvaluationResult> {
  return getReplayService().evaluateDecision(input);
}
