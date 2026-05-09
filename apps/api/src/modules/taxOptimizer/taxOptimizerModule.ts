import type { PaperTrade, PaperTradeDirection, PrismaClient } from "@prisma/client";

const BELKA_RATE = 0.19;
const CARRY_FORWARD_YEARS = 5;

export type TaxTradeRow = {
  ticker: string;
  openDate: string;
  closeDate: string;
  pnl: number;
  pnlPct: number;
};

export type TaxSuggestion = {
  type: "CLOSE_LOSS_BEFORE_YEAR_END" | "CARRY_FORWARD_LOSS";
  message: string;
  potentialSaving?: number;
  ticker?: string;
  lossValue?: number;
};

export type TaxOptimizerResult = {
  year: number;
  totalGains: number;
  totalLosses: number;
  netIncome: number;
  taxBase: number;
  taxAmount: number;
  alreadyPaid: number;
  taxToPay: number;
  trades: TaxTradeRow[];
  suggestions: TaxSuggestion[];
};

function toNum(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeClosedPnl(trade: PaperTrade): { pnl: number; pnlPct: number } {
  const stored = trade.pnl != null ? Number(trade.pnl) : NaN;
  if (Number.isFinite(stored)) {
    const pct = trade.pnlPct != null ? Number(trade.pnlPct) : 0;
    return { pnl: stored, pnlPct: Number.isFinite(pct) ? pct : 0 };
  }
  const qty = toNum(trade.quantity, 0);
  const entry = toNum(trade.entryPrice, 0);
  const exit = trade.exitPrice != null ? toNum(trade.exitPrice, 0) : 0;
  if (qty <= 0 || entry <= 0 || exit <= 0) return { pnl: 0, pnlPct: 0 };
  const dir = trade.direction as PaperTradeDirection;
  const pnl =
    dir === "LONG" ? (exit - entry) * qty : dir === "SHORT" ? (entry - exit) * qty : 0;
  const denom = entry * qty;
  const pnlPct = denom > 0 ? (pnl / denom) * 100 : 0;
  return { pnl, pnlPct };
}

function yearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}

async function unrealizedOpenLosses(
  prisma: PrismaClient,
  userId: string,
): Promise<Array<{ ticker: string; unrealizedPnl: number }>> {
  const open = await prisma.paperTrade.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { entryAt: "desc" },
  });
  const out: Array<{ ticker: string; unrealizedPnl: number }> = [];
  for (const row of open) {
    const ticker = String(row.ticker).toUpperCase();
    const qty = toNum(row.quantity, 0);
    const entry = toNum(row.entryPrice, 0);
    if (qty <= 0 || entry <= 0) continue;
    const quote = await prisma.quote.findFirst({
      where: { symbol: ticker },
      orderBy: { timestamp: "desc" },
    });
    const current = quote ? toNum(quote.close, entry) : entry;
    const dir = row.direction as PaperTradeDirection;
    const pnl = dir === "LONG" ? (current - entry) * qty : dir === "SHORT" ? (entry - current) * qty : 0;
    if (pnl < 0) out.push({ ticker, unrealizedPnl: pnl });
  }
  return out;
}

/** Net (gains − losses) from closed trades in [start, end). */
async function netClosedInRange(
  prisma: PrismaClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<{ gains: number; losses: number }> {
  const rows = await prisma.paperTrade.findMany({
    where: {
      userId,
      status: "CLOSED",
      exitAt: { gte: start, lt: end },
    },
  });
  let gains = 0;
  let losses = 0;
  for (const row of rows) {
    const { pnl } = computeClosedPnl(row);
    if (pnl > 0) gains += pnl;
    else if (pnl < 0) losses += Math.abs(pnl);
  }
  return { gains, losses };
}

/**
 * PIT-38 / Belka 19% — uproszczone podsumowanie z zamkniętych paper trades (exitAt w danym roku).
 */
export async function calculateTax(
  prisma: PrismaClient,
  userId: string,
  year?: number,
): Promise<TaxOptimizerResult> {
  const y = year ?? new Date().getUTCFullYear();
  const { start, end } = yearBounds(y);

  const closedRows = await prisma.paperTrade.findMany({
    where: {
      userId,
      status: "CLOSED",
      exitAt: { gte: start, lt: end },
    },
    orderBy: { exitAt: "desc" },
  });

  const trades: TaxTradeRow[] = [];
  let totalGains = 0;
  let totalLosses = 0;

  for (const row of closedRows) {
    const { pnl, pnlPct } = computeClosedPnl(row);
    const exitAt = row.exitAt ?? row.entryAt;
    trades.push({
      ticker: String(row.ticker).toUpperCase(),
      openDate: row.entryAt.toISOString(),
      closeDate: exitAt.toISOString(),
      pnl,
      pnlPct,
    });
    if (pnl > 0) totalGains += pnl;
    else if (pnl < 0) totalLosses += Math.abs(pnl);
  }

  const netIncome = totalGains - totalLosses;
  const taxBase = Math.max(0, netIncome);
  const taxAmount = taxBase * BELKA_RATE;
  const alreadyPaid = 0;
  const taxToPay = taxAmount;

  const suggestions: TaxSuggestion[] = [];

  if (netIncome > 0) {
    const losers = await unrealizedOpenLosses(prisma, userId);
    for (const { ticker, unrealizedPnl } of losers) {
      const lossAbs = Math.abs(unrealizedPnl);
      const rawSaving = lossAbs * BELKA_RATE;
      const cappedSaving = Math.min(rawSaving, taxAmount);
      suggestions.push({
        type: "CLOSE_LOSS_BEFORE_YEAR_END",
        ticker,
        lossValue: lossAbs,
        potentialSaving: Math.round(cappedSaving * 100) / 100,
        message: `Rozważ zamknięcie pozycji ${ticker} przed 31.12 — strata ${lossAbs.toFixed(2)} PLN zmniejszy podatek o ok. ${cappedSaving.toFixed(2)} PLN.`,
      });
    }
  }

  let carryPool = 0;
  for (let py = y - CARRY_FORWARD_YEARS; py < y; py++) {
    const b = yearBounds(py);
    const { gains, losses } = await netClosedInRange(prisma, userId, b.start, b.end);
    const net = gains - losses;
    if (net < 0) carryPool += Math.abs(net);
  }
  if (carryPool > 0) {
    suggestions.push({
      type: "CARRY_FORWARD_LOSS",
      message: `Masz nieodliczone straty z lat poprzednich (łącznie ok. ${carryPool.toFixed(2)} PLN netto straty w oknie ${CARRY_FORWARD_YEARS} lat) — rozważ rozliczenie z doradcą podatkowym.`,
      potentialSaving: undefined,
    });
  }

  return {
    year: y,
    totalGains: Math.round(totalGains * 100) / 100,
    totalLosses: Math.round(totalLosses * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    taxBase: Math.round(taxBase * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    alreadyPaid,
    taxToPay: Math.round(taxToPay * 100) / 100,
    trades,
    suggestions,
  };
}
