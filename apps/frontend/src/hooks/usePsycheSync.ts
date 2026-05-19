import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import {
  apiScoresToStored,
  DEFAULT_PSYCHE_API,
  psycheLocalStorageKey,
  storedScoresToApi,
  type PsycheApiScores,
  type PsycheHistoryPoint,
  type SyncSource,
} from "../utils/psycheSync";
import type { StoredPsycheScores } from "../utils/coachPaperTrading";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function usePsycheSync(userId: string | null) {
  const [psycheData, setPsycheData] = useState<PsycheApiScores>(DEFAULT_PSYCHE_API);
  const [history, setHistory] = useState<PsycheHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncSource, setSyncSource] = useState<SyncSource>("local");
  const psycheDataRef = useRef(psycheData);
  psycheDataRef.current = psycheData;

  const loadFromLocal = useCallback((id: string): PsycheApiScores | null => {
    try {
      const raw = localStorage.getItem(psycheLocalStorageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredPsycheScores;
      return storedScoresToApi({
        fomoResilience: Number(parsed.fomoResilience) || 50,
        discipline: Number(parsed.discipline) || 50,
        greedManagement: Number(parsed.greedManagement) || 50,
        patience: Number(parsed.patience) || 50,
        updatedAt: parsed.updatedAt,
      });
    } catch {
      return null;
    }
  }, []);

  const persistLocal = useCallback((id: string, data: PsycheApiScores) => {
    localStorage.setItem(psycheLocalStorageKey(id), JSON.stringify(apiScoresToStored(data)));
  }, []);

  const pushSnapshot = useCallback(
    async (id: string, data: PsycheApiScores) => {
      persistLocal(id, data);
      try {
        await api.post("/behavioral/psyche-snapshot", {
          userId: id,
          ...data,
        });
        setSyncSource("api");
      } catch {
        setSyncSource("local");
      }
    },
    [persistLocal],
  );

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setSyncSource("local");
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [latestRes, historyRes] = await Promise.all([
          api.get<PsycheApiScores>(`/behavioral/psyche-latest/${encodeURIComponent(userId)}`),
          api.get<{ history: PsycheHistoryPoint[] }>(
            `/behavioral/psyche-history/${encodeURIComponent(userId)}?days=30`,
          ),
        ]);
        if (cancelled) return;
        setPsycheData({
          fomoScore: latestRes.data.fomoScore,
          discipline: latestRes.data.discipline,
          greedControl: latestRes.data.greedControl,
          patience: latestRes.data.patience,
          growthScore: latestRes.data.growthScore,
          createdAt: latestRes.data.createdAt ?? null,
        });
        setHistory(historyRes.data.history ?? []);
        persistLocal(userId, latestRes.data);
        setSyncSource("api");
      } catch {
        if (cancelled) return;
        const local = loadFromLocal(userId);
        if (local) setPsycheData(local);
        setHistory([]);
        setSyncSource("local");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, loadFromLocal, persistLocal]);

  useEffect(() => {
    if (!userId) return undefined;
    const timer = window.setInterval(() => {
      void pushSnapshot(userId, psycheDataRef.current);
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [userId, pushSnapshot]);

  const saveSnapshot = useCallback(
    async (data: PsycheApiScores) => {
      setPsycheData(data);
      if (!userId) return;
      await pushSnapshot(userId, data);
    },
    [pushSnapshot, userId],
  );

  const saveStoredScores = useCallback(
    async (scores: StoredPsycheScores) => {
      await saveSnapshot(storedScoresToApi(scores));
    },
    [saveSnapshot],
  );

  return {
    psycheData,
    storedScores: apiScoresToStored(psycheData),
    history,
    saveSnapshot,
    saveStoredScores,
    loading,
    syncSource,
  };
}
