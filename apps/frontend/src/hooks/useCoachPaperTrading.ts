import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoachSnapshotLike, EmotionJournalEntry, EmotionJournalState, PsycheRadarPoint } from "../utils/behavioralCoachData";
import { emotionJournalStorageKey } from "../utils/behavioralCoachData";
import {
  applyCloseTradeImpact,
  applyEmotionTradeImpact,
  applyJournalBoost,
  calculateProfitLoss,
  type CoachPaperTrade,
  paperTradesStorageKey,
  psycheScoresStorageKey,
  readPaperTrades,
  readPsycheScores,
  scoresFromSnapshot,
  toRadarMetrics,
  writePaperTrades,
  writePsycheScores,
} from "../utils/coachPaperTrading";

type OpenTradeInput = {
  symbol: string;
  entryPrice: number;
  quantity: number;
  emotion: EmotionJournalState;
};

type CloseTradeInput = {
  tradeId: string;
  closePrice: number;
};

export function useCoachPaperTrading(userId: string, snapshot: CoachSnapshotLike | null) {
  const tradesKey = paperTradesStorageKey(userId);
  const scoresKey = psycheScoresStorageKey(userId);
  const journalKey = emotionJournalStorageKey(userId);

  const [trades, setTrades] = useState<CoachPaperTrade[]>([]);
  const [psycheScores, setPsycheScores] = useState(() => scoresFromSnapshot(snapshot));
  const [emotion, setEmotion] = useState<EmotionJournalState | null>(null);
  const [emotionAcknowledged, setEmotionAcknowledged] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTrades = readPaperTrades(tradesKey);
    const storedScores = readPsycheScores(scoresKey);
    setTrades(storedTrades);
    setPsycheScores(storedScores ?? scoresFromSnapshot(snapshot));
    setHydrated(true);
  }, [tradesKey, scoresKey, snapshot]);

  const persistScores = useCallback(
    (scores: typeof psycheScores) => {
      setPsycheScores(scores);
      writePsycheScores(scoresKey, scores);
    },
    [scoresKey],
  );

  const persistTrades = useCallback(
    (next: CoachPaperTrade[]) => {
      setTrades(next);
      writePaperTrades(tradesKey, next);
    },
    [tradesKey],
  );

  const selectEmotion = useCallback((next: EmotionJournalState) => {
    setEmotion(next);
    setEmotionAcknowledged(true);
  }, []);

  const openPaperTrade = useCallback(
    (input: OpenTradeInput) => {
      if (!emotionAcknowledged || !input.emotion) {
        return { ok: false as const, error: "Wybierz emocję przed zleceniem paper." };
      }

      const symbol = input.symbol.trim().toUpperCase();
      if (!symbol || input.quantity <= 0 || input.entryPrice <= 0) {
        return { ok: false as const, error: "Uzupełnij symbol, ilość i cenę wejścia." };
      }

      const seed = Date.now();
      const currentScores = readPsycheScores(scoresKey) ?? psycheScores;
      const nextScores = applyEmotionTradeImpact(currentScores, input.emotion, seed);
      persistScores(nextScores);

      const trade: CoachPaperTrade = {
        id: `pt-${seed}`,
        symbol,
        action: "BUY",
        entryPrice: input.entryPrice,
        quantity: input.quantity,
        emotionAtEntry: input.emotion,
        status: "OPEN",
        closePrice: null,
        profitLoss: null,
        openedAt: new Date(seed).toISOString(),
        closedAt: null,
      };

      persistTrades([trade, ...readPaperTrades(tradesKey)]);
      return { ok: true as const, trade };
    },
    [emotionAcknowledged, persistScores, persistTrades, psycheScores, scoresKey, tradesKey],
  );

  const closePaperTrade = useCallback(
    (input: CloseTradeInput) => {
      const rows = readPaperTrades(tradesKey);
      const trade = rows.find((row) => row.id === input.tradeId && row.status === "OPEN");
      if (!trade) {
        return { ok: false as const, error: "Nie znaleziono otwartej pozycji." };
      }
      if (input.closePrice <= 0) {
        return { ok: false as const, error: "Podaj prawidłową cenę zamknięcia." };
      }

      const profitLoss = calculateProfitLoss(trade.action, trade.entryPrice, input.closePrice, trade.quantity);
      const seed = Date.now();
      const currentScores = readPsycheScores(scoresKey) ?? psycheScores;
      const nextScores = applyCloseTradeImpact(currentScores, profitLoss, trade.emotionAtEntry, seed);

      const closed: CoachPaperTrade = {
        ...trade,
        status: "CLOSED",
        closePrice: input.closePrice,
        profitLoss,
        closedAt: new Date(seed).toISOString(),
      };

      persistScores(nextScores);
      persistTrades(rows.map((row) => (row.id === trade.id ? closed : row)));
      return { ok: true as const, trade: closed };
    },
    [persistScores, persistTrades, psycheScores, scoresKey, tradesKey],
  );

  const logJournalEntry = useCallback(
    (entry: EmotionJournalEntry) => {
      const existingRaw = window.localStorage.getItem(journalKey);
      let existing: EmotionJournalEntry[] = [];
      try {
        existing = existingRaw ? (JSON.parse(existingRaw) as EmotionJournalEntry[]) : [];
      } catch {
        existing = [];
      }
      const nextJournal = [entry, ...existing].slice(0, 12);
      window.localStorage.setItem(journalKey, JSON.stringify(nextJournal));

      if (entry.emotion === "NEUTRAL" || entry.emotion === "CONFIDENT") {
        const seed = Date.parse(entry.createdAt) || Date.now();
        const currentScores = readPsycheScores(scoresKey) ?? psycheScores;
        const boosted = applyJournalBoost(currentScores, entry.emotion, seed);
        persistScores(boosted);
      }
    },
    [journalKey, persistScores, psycheScores, scoresKey],
  );

  const psycheMetrics: PsycheRadarPoint[] = useMemo(() => toRadarMetrics(psycheScores), [psycheScores]);

  const openTrades = useMemo(() => trades.filter((row) => row.status === "OPEN"), [trades]);
  const closedTrades = useMemo(() => trades.filter((row) => row.status === "CLOSED").slice(0, 6), [trades]);

  return {
    hydrated,
    emotion,
    emotionAcknowledged,
    selectEmotion,
    psycheMetrics,
    psycheScores,
    trades,
    openTrades,
    closedTrades,
    openPaperTrade,
    closePaperTrade,
    logJournalEntry,
  };
}
