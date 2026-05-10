import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/index";

export const DECISION_RECEIPT_KIND = {
  PROCEED_PREMORTEM: "PROCEED_PREMORTEM",
  CLOSED_LOSS: "CLOSED_LOSS",
} as const;

export type DecisionReceiptKind = (typeof DECISION_RECEIPT_KIND)[keyof typeof DECISION_RECEIPT_KIND];

export type DecisionReceiptRow = {
  id: string;
  userId: string;
  paperTradeId: string | null;
  kind: string;
  symbol: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
};

export async function createDecisionReceipt(input: {
  userId: string;
  paperTradeId?: string | null;
  kind: DecisionReceiptKind;
  symbol: string;
  payload: Prisma.InputJsonValue;
}): Promise<DecisionReceiptRow> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("symbol is required");

  if (input.paperTradeId) {
    const trade = await prisma.paperTrade.findFirst({
      where: { id: input.paperTradeId, userId: input.userId },
      select: { id: true },
    });
    if (!trade) throw new Error("Paper trade not found for user");
  }

  const row = await prisma.decisionReceipt.create({
    data: {
      userId: input.userId,
      paperTradeId: input.paperTradeId ?? null,
      kind: input.kind,
      symbol,
      payload: input.payload,
    },
  });
  return row as DecisionReceiptRow;
}

export async function listDecisionReceipts(userId: string, take = 40): Promise<DecisionReceiptRow[]> {
  const rows = await prisma.decisionReceipt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, take)),
  });
  return rows as DecisionReceiptRow[];
}
