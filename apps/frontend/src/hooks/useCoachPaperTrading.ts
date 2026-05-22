import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoachSnapshotLike, EmotionJournalEntry, EmotionJournalState, PsycheRadarPoint } from "../utils/behavioralCoachData";
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
  type StoredPsycheScores,
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

type PsycheSyncAdapter = {
  storedScores: StoredPsycheScores;
  saveStoredScores: (scores: StoredPsycheScores) => Promise<void>;
  psycheHydrated: boolean;
};

type EmotionSyncAdapter = {
  logEmotion: (entry: EmotionJournalEntry) => Promise<EmotionJournalEntry | void>;
};

export function useCoachPaperTrading(
  userId: string,
  snapshot: CoachSnapshotLike | null,
  adapters?: {
    psyche?: PsycheSyncAdapter;
    emotion?: EmotionSyncAdapter;
  },
) {
  const tradesKey = paperTradesStorageKey(userId);
  const scoresKey = psycheScoresStorageKey(userId);

  const [trades, setTrades] = useState<CoachPaperTrade[]>([]);
  const [psycheScores, setPsycheScores] = useState(() => adapters?.psyche?.storedScores ?? scoresFromSnapshot(snapshot));
  const [emotion, setEmotion] = useState<EmotionJournalState | null>(null);
  const [emotionAcknowledged, setEmotionAcknowledged] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTrades = readPaperTrades(tradesKey);
    setTrades(storedTrades);
    if (!adapters?.psyche) {
      const storedScores = readPsycheScores(scoresKey);
      setPsycheScores(storedScores ?? scoresFromSnapshot(snapshot));
    }
    setHydrated(true);
  }, [tradesKey, scoresKey, snapshot, adapters?.psyche]);

  useEffect(() => {
    if (!adapters?.psyche?.psycheHydrated) return;
    setPsycheScores(adapters.psyche.storedScores);
  }, [adapters?.psyche?.psycheHydrated, adapters?.psyche?.storedScores]);

  const persistScores = useCallback(
    (scores: StoredPsycheScores) => {
      setPsycheScores(scores);
      if (adapters?.psyche) {
        void adapters.psyche.saveStoredScores(scores);
        return;
      }
      writePsycheScores(scoresKey, scores);
    },
    [adapters?.psyche, scoresKey],
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
        return { ok: false as const, error: "Select an emotion before placing a paper order." };
      }

      const symbol = input.symbol.trim().toUpperCase();
      if (!symbol || input.quantity <= 0 || input.entryPrice <= 0) {
        return { ok: false as const, error: "Enter symbol, quantity, and entry price." };
      }

      const seed = Date.now();
      const currentScores = psycheScores;
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
    [emotionAcknowledged, persistScores, persistTrades, psycheScores, tradesKey],
  );

  const closePaperTrade = useCallback(
    (input: CloseTradeInput) => {
      const rows = readPaperTrades(tradesKey);
      const trade = rows.find((row) => row.id === input.tradeId && row.status === "OPEN");
      if (!trade) {
        return { ok: false as const, error: "Nie znaleziono otwartej pozycji." };
      }
      if (input.closePrice <= 0) {
        return { ok: false as const, error: "Enter a valid closing price." };
      }

      const profitLoss = calculateProfitLoss(trade.action, trade.entryPrice, input.closePrice, trade.quantity);
      const seed = Date.now();
      const nextScores = applyCloseTradeImpact(psycheScores, profitLoss, trade.emotionAtEntry, seed);

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
    [persistScores, persistTrades, psycheScores, tradesKey],
  );

  const logJournalEntry = useCallback(
    async (entry: EmotionJournalEntry) => {
      if (adapters?.emotion) {
        await adapters.emotion.logEmotion(entry);
      }

      if (entry.emotion === "NEUTRAL" || entry.emotion === "CONFIDENT") {
        const seed = Date.parse(entry.createdAt) || Date.now();
        const boosted = applyJournalBoost(psycheScores, entry.emotion, seed);
        persistScores(boosted);
      }
    },
    [adapters?.emotion, persistScores, psycheScores],
  );

  const psycheMetrics: PsycheRadarPoint[] = useMemo(() => toRadarMetrics(psycheScores), [psycheScores]);

  const openTrades = useMemo(() => trades.filter((row) => row.status === "OPEN"), [trades]);
  const closedTrades = useMemo(() => trades.filter((row) => row.status === "CLOSED").slice(0, 6), [trades]);

  return {
    hydrated: hydrated && (adapters?.psyche?.psycheHydrated ?? true),
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
