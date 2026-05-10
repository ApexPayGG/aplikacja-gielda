import { prisma } from "../../db/index";

export const TRADE_REACTION_MAX_CONTENT = 500;

export type TradeReactionRow = {
  id: string;
  userId: string;
  tradeId: string | null;
  signalId: string | null;
  content: string;
  createdAt: Date;
};

export type TradeReactionPublic = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
};

function normalizeContent(raw: string): string {
  const content = raw.trim();
  if (!content) throw new Error("content is required");
  if (content.length > TRADE_REACTION_MAX_CONTENT) {
    throw new Error(`content must be at most ${TRADE_REACTION_MAX_CONTENT} characters`);
  }
  return content;
}

function toPublic(row: { id: string; userId: string; content: string; createdAt: Date }): TradeReactionPublic {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createTradeReaction(input: {
  userId: string;
  tradeId: string;
  content: string;
}): Promise<TradeReactionRow> {
  const userId = input.userId.trim();
  const tradeId = input.tradeId.trim();
  if (!userId || !tradeId) throw new Error("userId and tradeId are required");
  const content = normalizeContent(input.content);

  const trade = await prisma.paperTrade.findFirst({
    where: { id: tradeId, userId },
    select: { id: true },
  });
  if (!trade) throw new Error("Paper trade not found for user");

  const row = await prisma.tradeReaction.create({
    data: { userId, tradeId, signalId: null, content },
  });
  return row as TradeReactionRow;
}

export async function createSignalReaction(input: {
  userId: string;
  signalId: string;
  content: string;
}): Promise<TradeReactionRow> {
  const userId = input.userId.trim();
  const signalId = input.signalId.trim();
  if (!userId || !signalId) throw new Error("userId and signalId are required");
  const content = normalizeContent(input.content);

  const signal = await prisma.signal.findUnique({
    where: { id: signalId },
    select: { id: true },
  });
  if (!signal) throw new Error("Signal not found");

  const row = await prisma.tradeReaction.create({
    data: { userId, tradeId: null, signalId, content },
  });
  return row as TradeReactionRow;
}

export async function listTradeReactions(tradeId: string): Promise<TradeReactionPublic[]> {
  const id = tradeId.trim();
  if (!id) throw new Error("tradeId is required");
  const rows = await prisma.tradeReaction.findMany({
    where: { tradeId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, content: true, createdAt: true },
  });
  return rows.map(toPublic);
}

export async function listSignalReactions(signalId: string): Promise<TradeReactionPublic[]> {
  const id = signalId.trim();
  if (!id) throw new Error("signalId is required");
  const rows = await prisma.tradeReaction.findMany({
    where: { signalId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, content: true, createdAt: true },
  });
  return rows.map(toPublic);
}
