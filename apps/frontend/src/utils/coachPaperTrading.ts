import type {
  CoachSnapshotLike,
  EmotionJournalEntry,
  EmotionJournalState,
  PsycheMetricKey,
  PsycheRadarPoint,
} from "./behavioralCoachData";
import { buildPsycheRadarMetrics, PSYCHE_METRIC_KEYS } from "./behavioralCoachData";

export type PaperTradeAction = "BUY" | "SELL";
export type PaperTradeStatus = "OPEN" | "CLOSED";

export type CoachPaperTrade = {
  id: string;
  symbol: string;
  action: PaperTradeAction;
  entryPrice: number;
  quantity: number;
  emotionAtEntry: EmotionJournalState;
  status: PaperTradeStatus;
  closePrice: number | null;
  profitLoss: number | null;
  openedAt: string;
  closedAt: string | null;
  journalEntryId?: string;
};

export type StoredPsycheScores = {
  fomoResilience: number;
  discipline: number;
  greedManagement: number;
  patience: number;
  updatedAt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function impactDelta(seed: number): number {
  return 5 + (Math.abs(seed) % 6);
}

export function paperTradesStorageKey(userId: string): string {
  return `stockai:coach-paper-trades:${userId}`;
}

export function psycheScoresStorageKey(userId: string): string {
  return `stockai:coach-psyche-scores:${userId}`;
}

export function scoresFromSnapshot(snapshot: CoachSnapshotLike | null): StoredPsycheScores {
  const radar = buildPsycheRadarMetrics(snapshot);
  const find = (key: PsycheMetricKey) => radar.find((row) => row.metricKey === key)?.score ?? 60;
  return {
    fomoResilience: find("fomoResilience"),
    discipline: find("discipline"),
    greedManagement: find("greedManagement"),
    patience: find("patience"),
    updatedAt: new Date().toISOString(),
  };
}

export function toRadarMetrics(scores: StoredPsycheScores): PsycheRadarPoint[] {
  return PSYCHE_METRIC_KEYS.map((metricKey) => ({
    metricKey,
    score: scores[metricKey],
  }));
}

export function readPaperTrades(key: string): CoachPaperTrade[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is CoachPaperTrade =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as CoachPaperTrade).id === "string" &&
        typeof (row as CoachPaperTrade).symbol === "string",
    );
  } catch {
    return [];
  }
}

export function writePaperTrades(key: string, trades: CoachPaperTrade[]): void {
  window.localStorage.setItem(key, JSON.stringify(trades.slice(0, 40)));
}

export function readPsycheScores(key: string): StoredPsycheScores | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPsycheScores;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      fomoResilience: clamp(Number(parsed.fomoResilience) || 60, 15, 99),
      discipline: clamp(Number(parsed.discipline) || 60, 15, 99),
      greedManagement: clamp(Number(parsed.greedManagement) || 60, 15, 99),
      patience: clamp(Number(parsed.patience) || 60, 15, 99),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writePsycheScores(key: string, scores: StoredPsycheScores): void {
  window.localStorage.setItem(
    key,
    JSON.stringify({
      ...scores,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function applyEmotionTradeImpact(
  scores: StoredPsycheScores,
  emotion: EmotionJournalState,
  seed: number,
): StoredPsycheScores {
  const delta = impactDelta(seed);
  const next = { ...scores };

  if (emotion === "GREEDY") {
    next.greedManagement = clamp(next.greedManagement - delta, 15, 99);
    next.discipline = clamp(next.discipline - delta, 15, 99);
  } else if (emotion === "FEARFUL") {
    next.fomoResilience = clamp(next.fomoResilience - delta, 15, 99);
  }

  return next;
}

export function applyJournalBoost(scores: StoredPsycheScores, emotion: EmotionJournalState, seed: number): StoredPsycheScores {
  if (emotion !== "NEUTRAL" && emotion !== "CONFIDENT") {
    return scores;
  }
  const delta = impactDelta(seed + 3);
  return {
    ...scores,
    discipline: clamp(scores.discipline + delta, 15, 99),
    patience: clamp(scores.patience + delta, 15, 99),
    updatedAt: new Date().toISOString(),
  };
}

export function applyCloseTradeImpact(
  scores: StoredPsycheScores,
  profitLoss: number,
  emotion: EmotionJournalState,
  seed: number,
): StoredPsycheScores {
  const delta = impactDelta(seed + 7);
  const next = { ...scores };

  if (profitLoss < 0 && emotion === "GREEDY") {
    next.greedManagement = clamp(next.greedManagement - Math.round(delta / 2), 15, 99);
  }
  if (profitLoss > 0 && (emotion === "NEUTRAL" || emotion === "CONFIDENT")) {
    next.discipline = clamp(next.discipline + Math.round(delta / 2), 15, 99);
    next.patience = clamp(next.patience + Math.round(delta / 2), 15, 99);
  }
  if (profitLoss < 0 && emotion === "FEARFUL") {
    next.fomoResilience = clamp(next.fomoResilience - Math.round(delta / 2), 15, 99);
  }

  return next;
}

export function calculateProfitLoss(
  action: PaperTradeAction,
  entryPrice: number,
  closePrice: number,
  quantity: number,
): number {
  const diff = closePrice - entryPrice;
  const signed = action === "BUY" ? diff : -diff;
  return Math.round(signed * quantity * 100) / 100;
}

export const PAPER_SYMBOL_PRESETS = ["NVDA", "AAPL", "ABBN", "MSFT", "TSLA"] as const;

export type CoachTradingPersistPayload = {
  trades: CoachPaperTrade[];
  scores: StoredPsycheScores;
  journalEntries?: EmotionJournalEntry[];
};
