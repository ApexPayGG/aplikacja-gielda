import type { PaperTrade, PrismaClient, VirtualTrade } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";
import type {
  BehavioralAnalysisResult,
  BehavioralFlag,
  NormalizedTradeRecord,
  PreTradeCheckInput,
  PreTradeCheckResponse,
  TraderPsycheRecommendedAction,
  TraderPsycheRiskLevel,
  TraderPsycheStatsResponse,
  TraderPsycheTradeSide,
} from "./traderPsyche.types";

export const DEFAULT_LOOKBACK_DAYS = 30;
export const MAX_LOOKBACK_DAYS = 180;

const FLAG_WEIGHTS: Record<BehavioralFlag, number> = {
  FOMO_BIAS: 25,
  TILT_RISK: 20,
  REVENGE_TRADING: 25,
  OVERTRADING: 15,
  SIZE_ESCALATION: 20,
  LOW_CONVICTION_CHASING: 15,
};

const FLAG_WARNINGS: Record<BehavioralFlag, string> = {
  FOMO_BIAS:
    "Your recent trades show elevated FOMO probability. RiskManager recommends waiting for a retest before deploying capital.",
  TILT_RISK:
    "Recent loss streak followed by rapid re-entry suggests tilt risk. Slow down and reset your process.",
  REVENGE_TRADING:
    "You reopened exposure shortly after a losing exit. Revenge trading patterns increase drawdown risk.",
  OVERTRADING:
    "Trade count for the session is elevated. Overtrading often erodes edge through fees and noise.",
  SIZE_ESCALATION:
    "Position size is escalating after losses. Size escalation can amplify recovery pressure.",
  LOW_CONVICTION_CHASING:
    "Low conviction entry into an extended move suggests chasing. Wait for confirmation or reduce size.",
};

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

type TraderPsycheDb = Pick<PrismaClient, "virtualTrade" | "paperTrade">;

export type TraderPsycheServiceDeps = {
  db: TraderPsycheDb;
  now: () => Date;
};

function clampLookbackDays(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LOOKBACK_DAYS;
  return Math.min(MAX_LOOKBACK_DAYS, Math.max(1, Math.floor(raw)));
}

export function normalizeTradeSide(raw: string): TraderPsycheTradeSide | null {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "BUY" || normalized === "SELL" || normalized === "LONG" || normalized === "SHORT") {
    return normalized;
  }
  return null;
}

export function isLongSide(side: TraderPsycheTradeSide): boolean {
  return side === "BUY" || side === "LONG";
}

function computeNotional(quantity: number, price: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) return 0;
  return Math.abs(quantity * price);
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function sortByOpenedAt(trades: NormalizedTradeRecord[]): NormalizedTradeRecord[] {
  return [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
}

function getClosedLosses(trades: NormalizedTradeRecord[]): NormalizedTradeRecord[] {
  return trades.filter(
    (trade) =>
      trade.closedAt != null &&
      trade.pnlAmount != null &&
      Number.isFinite(trade.pnlAmount) &&
      trade.pnlAmount < 0,
  );
}

function getOpenEvents(trades: NormalizedTradeRecord[]): NormalizedTradeRecord[] {
  return sortByOpenedAt(trades);
}

export function detectFomoBias(input: PreTradeCheckInput): boolean {
  if (!isLongSide(input.side)) return false;
  const move = input.intradayMovePct ?? 0;
  if (move < 15) return false;
  return input.fundamentalsChecked !== true;
}

export function detectLowConvictionChasing(input: PreTradeCheckInput): boolean {
  if (!isLongSide(input.side)) return false;
  const signalScore = input.signalScore ?? 100;
  const move = input.intradayMovePct ?? 0;
  return signalScore < 60 && move > 5;
}

export function detectRevengeTrading(trades: NormalizedTradeRecord[], now: Date): boolean {
  const opens = getOpenEvents(trades);
  const losses = getClosedLosses(trades);

  for (const loss of losses) {
    if (!loss.closedAt) continue;
    const windowEnd = loss.closedAt.getTime() + 30 * MS_PER_MINUTE;
    const revengeOpen = opens.find(
      (open) =>
        open.openedAt.getTime() > loss.closedAt!.getTime() &&
        open.openedAt.getTime() <= windowEnd &&
        open.id !== loss.id,
    );
    if (revengeOpen) return true;
  }

  void now;
  return false;
}

export function detectOvertrading(trades: NormalizedTradeRecord[], now: Date): boolean {
  const todayKey = toUtcDayKey(now);
  const todayOpens = getOpenEvents(trades).filter((trade) => toUtcDayKey(trade.openedAt) === todayKey);
  return todayOpens.length > 10;
}

export function detectTiltRisk(trades: NormalizedTradeRecord[], now: Date): boolean {
  const since = now.getTime() - 24 * MS_PER_DAY;
  const recentLosses = getClosedLosses(trades).filter(
    (trade) => trade.closedAt && trade.closedAt.getTime() >= since,
  );
  if (recentLosses.length < 2) return false;

  const secondLoss = recentLosses.sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime())[1];
  if (!secondLoss?.closedAt) return false;

  const windowStart = secondLoss.closedAt.getTime();
  const windowEnd = windowStart + 60 * MS_PER_MINUTE;
  const opensInWindow = getOpenEvents(trades).filter(
    (trade) =>
      trade.openedAt.getTime() >= windowStart &&
      trade.openedAt.getTime() <= windowEnd,
  );

  return opensInWindow.length >= 3;
}

export function detectSizeEscalation(
  trades: NormalizedTradeRecord[],
  intendedNotional: number | undefined,
): boolean {
  const sorted = sortByOpenedAt(trades);
  if (sorted.length === 0) return false;

  const prior = sorted.slice(-10);
  const baseline = median(prior.map((trade) => trade.notional).filter((value) => value > 0));
  if (baseline <= 0) return false;

  const lastClosedLoss = [...sorted]
    .reverse()
    .find((trade) => trade.closedAt != null && trade.pnlAmount != null && trade.pnlAmount < 0);
  if (!lastClosedLoss) return false;

  const candidateNotional =
    intendedNotional != null && Number.isFinite(intendedNotional) && intendedNotional > 0
      ? intendedNotional
      : sorted.at(-1)?.notional ?? 0;

  if (candidateNotional <= 0) return false;
  return candidateNotional >= baseline * 2;
}

export function resolveRiskLevel(score: number, flags: BehavioralFlag[]): TraderPsycheRiskLevel {
  if (flags.length >= 3 || score >= 71) return "CRITICAL";
  if (score >= 46) return "HIGH";
  if (score >= 21) return "MEDIUM";
  return "LOW";
}

export function resolveRecommendedAction(
  riskLevel: TraderPsycheRiskLevel,
  flags: BehavioralFlag[],
): TraderPsycheRecommendedAction {
  if (riskLevel === "CRITICAL") return "BLOCK_AND_REVIEW";
  if (flags.includes("REVENGE_TRADING") || flags.includes("TILT_RISK")) {
    return riskLevel === "HIGH" ? "BLOCK_AND_REVIEW" : "WAIT_FOR_RETEST";
  }
  if (flags.includes("FOMO_BIAS") || flags.includes("LOW_CONVICTION_CHASING")) {
    return riskLevel === "HIGH" ? "REDUCE_SIZE" : "WAIT_FOR_RETEST";
  }
  if (flags.includes("SIZE_ESCALATION") || flags.includes("OVERTRADING")) {
    return riskLevel === "HIGH" ? "REDUCE_SIZE" : "WAIT_FOR_RETEST";
  }
  if (riskLevel === "HIGH") return "REDUCE_SIZE";
  if (riskLevel === "MEDIUM") return "WAIT_FOR_RETEST";
  return "ALLOW";
}

export function buildBehavioralAnalysis(input: {
  userId: string;
  trades: NormalizedTradeRecord[];
  now: Date;
  lookbackDays: number;
  ticker?: string | null;
  proposal?: PreTradeCheckInput;
}): BehavioralAnalysisResult {
  const flags = new Set<BehavioralFlag>();

  if (detectTiltRisk(input.trades, input.now)) flags.add("TILT_RISK");
  if (detectRevengeTrading(input.trades, input.now)) flags.add("REVENGE_TRADING");
  if (detectOvertrading(input.trades, input.now)) flags.add("OVERTRADING");
  if (detectSizeEscalation(input.trades, input.proposal?.intendedNotional)) flags.add("SIZE_ESCALATION");

  if (input.proposal) {
    if (detectFomoBias(input.proposal)) flags.add("FOMO_BIAS");
    if (detectLowConvictionChasing(input.proposal)) flags.add("LOW_CONVICTION_CHASING");
  }

  const flagList = [...flags];
  const score = Math.min(
    100,
    flagList.reduce((sum, flag) => sum + FLAG_WEIGHTS[flag], 0),
  );
  const riskLevel = resolveRiskLevel(score, flagList);
  const warnings = flagList.map((flag) => FLAG_WARNINGS[flag]);

  return {
    userId: input.userId,
    ticker: input.ticker ?? input.proposal?.ticker ?? null,
    score,
    riskLevel,
    flags: flagList,
    warnings,
    recommendedAction: resolveRecommendedAction(riskLevel, flagList),
    lookbackDays: input.lookbackDays,
    tradeCount: input.trades.length,
  };
}

function mapVirtualTrade(row: VirtualTrade): NormalizedTradeRecord {
  const side: TraderPsycheTradeSide = row.side === "BUY" ? "BUY" : "SELL";
  return {
    id: `virtual:${row.id}`,
    userId: row.userId,
    ticker: row.ticker.trim().toUpperCase(),
    side,
    quantity: row.quantity,
    notional: computeNotional(row.quantity, row.price),
    openedAt: row.executed_at,
    closedAt: row.pnl_amount != null ? row.executed_at : null,
    pnlAmount: row.pnl_amount,
    pnlPct: row.pnl_pct,
    signalScore: null,
    intradayMovePct: null,
    fundamentalsChecked: null,
  };
}

function mapPaperTrade(row: PaperTrade): NormalizedTradeRecord {
  const side: TraderPsycheTradeSide = row.direction === "LONG" ? "LONG" : "SHORT";
  return {
    id: `paper:${row.id}`,
    userId: row.userId,
    ticker: row.ticker.trim().toUpperCase(),
    side,
    quantity: row.quantity,
    notional: computeNotional(row.quantity, row.entryPrice),
    openedAt: row.entryAt,
    closedAt: row.exitAt,
    pnlAmount: row.pnl,
    pnlPct: row.pnlPct,
    signalScore: null,
    intradayMovePct: null,
    fundamentalsChecked: null,
  };
}

export async function loadUserTradeHistory(
  userId: string,
  lookbackDays: number,
  db: TraderPsycheDb,
  now: Date,
): Promise<NormalizedTradeRecord[]> {
  const since = new Date(now.getTime() - lookbackDays * MS_PER_DAY);

  const [virtualRows, paperRows] = await Promise.all([
    db.virtualTrade.findMany({
      where: { userId, executed_at: { gte: since } },
      orderBy: { executed_at: "asc" },
    }),
    db.paperTrade.findMany({
      where: { userId, entryAt: { gte: since } },
      orderBy: { entryAt: "asc" },
    }),
  ]);

  return [...virtualRows.map(mapVirtualTrade), ...paperRows.map(mapPaperTrade)].sort(
    (a, b) => a.openedAt.getTime() - b.openedAt.getTime(),
  );
}

export class TraderPsycheService {
  constructor(private readonly deps: TraderPsycheServiceDeps = { db: defaultPrisma, now: () => new Date() }) {}

  async getStats(userId: string, lookbackDaysInput?: number): Promise<TraderPsycheStatsResponse> {
    const lookbackDays = clampLookbackDays(lookbackDaysInput);
    const now = this.deps.now();
    const trades = await loadUserTradeHistory(userId, lookbackDays, this.deps.db, now);
    const analysis = buildBehavioralAnalysis({
      userId,
      trades,
      now,
      lookbackDays,
      ticker: null,
    });

    return {
      ...analysis,
      ticker: null,
    };
  }

  async preTradeCheck(
    userId: string,
    proposal: PreTradeCheckInput,
    lookbackDaysInput?: number,
  ): Promise<PreTradeCheckResponse> {
    const lookbackDays = clampLookbackDays(lookbackDaysInput);
    const now = this.deps.now();
    const trades = await loadUserTradeHistory(userId, lookbackDays, this.deps.db, now);

    return buildBehavioralAnalysis({
      userId,
      trades,
      now,
      lookbackDays,
      ticker: proposal.ticker.trim().toUpperCase(),
      proposal,
    });
  }
}

export const traderPsycheService = new TraderPsycheService();
