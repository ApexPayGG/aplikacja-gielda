import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

type MistakeType = "EMOTIONAL" | "STRATEGY" | "TIMING";

type ClosedTradeRow = {
  id: string;
  userId: string;
  ticker: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number | null;
  pnlPct: number | null;
  entryAt: Date;
  exitAt: Date | null;
  status: "OPEN" | "CLOSED";
};

type MistakeRow = {
  id: string;
  userId: string;
  tradeId: string;
  symbol: string;
  pnl: number;
  type: string;
  explanation: string;
  createdAt: Date;
};

type DbLike = {
  paperTrade: {
    findMany: (args: Record<string, unknown>) => Promise<ClosedTradeRow[]>;
  };
  mistakeLibrary: {
    findMany: (args: Record<string, unknown>) => Promise<MistakeRow[]>;
    findFirst: (args: Record<string, unknown>) => Promise<MistakeRow | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<MistakeRow>;
  };
};

const db = prisma as unknown as DbLike;
const MODEL = "claude-sonnet-4-20250514";

type MistakeSummaryResponse = {
  mistakes: Array<{
    id: string;
    symbol: string;
    pnl: number;
    type: MistakeType;
    explanation: string;
    createdAt: string;
  }>;
  summary: {
    total: number;
    emotional: number;
    strategy: number;
    timing: number;
  };
};

function clampExplanation(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 20).join(" ");
}

function calcHoldingHours(entryAt: Date, exitAt: Date | null): number {
  if (!exitAt) return 0;
  return Math.max(0, (exitAt.getTime() - entryAt.getTime()) / (1000 * 60 * 60));
}

function calcPnlPercent(row: ClosedTradeRow): number {
  if (typeof row.pnlPct === "number" && Number.isFinite(row.pnlPct)) return row.pnlPct;
  if (row.exitPrice == null || !Number.isFinite(row.entryPrice) || row.entryPrice === 0) return 0;
  return ((row.exitPrice - row.entryPrice) / row.entryPrice) * 100;
}

function parseClassification(raw: string): { type: MistakeType; explanation: string } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : raw;
  let parsed: { type?: unknown; explanation?: unknown };
  try {
    parsed = JSON.parse(payload) as { type?: unknown; explanation?: unknown };
  } catch {
    throw new Error(`Invalid classifier JSON: ${raw.slice(0, 120)}`);
  }
  const type = String(parsed.type ?? "").trim().toUpperCase();
  if (type !== "EMOTIONAL" && type !== "STRATEGY" && type !== "TIMING") {
    throw new Error(`Invalid classifier type: ${type || "(empty)"}`);
  }
  const explanationRaw = String(parsed.explanation ?? "").trim();
  return {
    type,
    explanation: clampExplanation(explanationRaw || "Losing trade pattern detected."),
  };
}

async function classifyTradeWithClaude(symbol: string, pnlPct: number, holdingHours: number): Promise<{ type: MistakeType; explanation: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Mistake classification requires Claude.");
  }

  const client = new Anthropic({ apiKey });
  const prompt =
    `Classify this losing trade as one of: EMOTIONAL (fear/greed driven), ` +
    `STRATEGY (wrong setup or entry), TIMING (right idea, wrong moment).\n` +
    `Return JSON: { type, explanation (max 20 words) }\n` +
    `Trade: symbol=${symbol}, pnl=${pnlPct.toFixed(2)}%, held=${holdingHours.toFixed(2)}h`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  const text = block?.type === "text" ? block.text : "";
  return parseClassification(text);
}

export async function analyzeMistakesForUser(userId: string): Promise<{ analyzed: number }> {
  const trades = await db.paperTrade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { exitAt: "desc" },
  });

  const losers = trades.filter((t) => calcPnlPercent(t) < 0);
  if (losers.length === 0) return { analyzed: 0 };

  const existing = await db.mistakeLibrary.findMany({
    where: { userId },
    select: { tradeId: true },
  });
  const existingTradeIds = new Set(existing.map((m) => m.tradeId));

  let analyzed = 0;
  for (const trade of losers) {
    if (existingTradeIds.has(trade.id)) continue;
    const pnlPct = calcPnlPercent(trade);
    const holdingHours = calcHoldingHours(trade.entryAt, trade.exitAt);
    const cls = await classifyTradeWithClaude(trade.ticker, pnlPct, holdingHours);

    const already = await db.mistakeLibrary.findFirst({
      where: { tradeId: trade.id, userId },
      select: { id: true },
    });
    if (already) continue;

    await db.mistakeLibrary.create({
      data: {
        userId,
        tradeId: trade.id,
        symbol: trade.ticker,
        pnl: Number(pnlPct.toFixed(4)),
        type: cls.type,
        explanation: cls.explanation,
      },
    });
    analyzed += 1;
  }

  return { analyzed };
}

export async function getMistakeLibrary(userId: string): Promise<MistakeSummaryResponse> {
  const rows = await db.mistakeLibrary.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const mistakes = rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    pnl: Number(row.pnl),
    type: (String(row.type).toUpperCase() as MistakeType) || "STRATEGY",
    explanation: row.explanation,
    createdAt: new Date(row.createdAt).toISOString(),
  }));

  const summary = {
    total: mistakes.length,
    emotional: mistakes.filter((m) => m.type === "EMOTIONAL").length,
    strategy: mistakes.filter((m) => m.type === "STRATEGY").length,
    timing: mistakes.filter((m) => m.type === "TIMING").length,
  };

  return { mistakes, summary };
}
