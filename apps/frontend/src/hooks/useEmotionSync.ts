import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { EmotionJournalEntry } from "../utils/behavioralCoachData";
import { emotionJournalStorageKey } from "../utils/behavioralCoachData";
import { apiEmotionFromJournal, journalEmotionFromApi, type SyncSource } from "../utils/psycheSync";

type ApiEmotionRow = {
  id: string;
  userId: string;
  emotion: string;
  ticker?: string | null;
  note?: string | null;
  createdAt: string;
};

function readLocalEntries(userId: string): EmotionJournalEntry[] {
  try {
    const raw = localStorage.getItem(emotionJournalStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is EmotionJournalEntry =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as EmotionJournalEntry).id === "string" &&
        typeof (row as EmotionJournalEntry).emotion === "string",
    );
  } catch {
    return [];
  }
}

function writeLocalEntries(userId: string, entries: EmotionJournalEntry[]): void {
  localStorage.setItem(emotionJournalStorageKey(userId), JSON.stringify(entries.slice(0, 12)));
}

function mapApiRow(row: ApiEmotionRow): EmotionJournalEntry {
  return {
    id: row.id,
    emotion: journalEmotionFromApi(row.emotion),
    note: row.note ?? "",
    symbol: row.ticker ?? undefined,
    createdAt: row.createdAt,
  };
}

export function useEmotionSync(userId: string | null) {
  const [entries, setEntries] = useState<EmotionJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncSource, setSyncSource] = useState<SyncSource>("local");

  const refreshEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get<ApiEmotionRow[]>(
        `/behavioral/emotions/${encodeURIComponent(userId)}?limit=20`,
      );
      const mapped = data.map(mapApiRow);
      setEntries(mapped);
      writeLocalEntries(userId, mapped);
      setSyncSource("api");
    } catch {
      setEntries(readLocalEntries(userId));
      setSyncSource("local");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  const logEmotion = useCallback(
    async (entry: EmotionJournalEntry) => {
      if (!userId) return entry;

      const nextEntries = [entry, ...entries].slice(0, 12);
      setEntries(nextEntries);
      writeLocalEntries(userId, nextEntries);

      try {
        const { data } = await api.post<ApiEmotionRow>("/behavioral/emotion", {
          userId,
          emotion: apiEmotionFromJournal(entry.emotion),
          ticker: entry.symbol,
          note: entry.note,
        });
        const saved = mapApiRow(data);
        setEntries((prev) => [saved, ...prev.filter((row) => row.id !== entry.id)].slice(0, 12));
        writeLocalEntries(userId, [saved, ...readLocalEntries(userId).filter((row) => row.id !== entry.id)].slice(0, 11));
        setSyncSource("api");
        return saved;
      } catch {
        setSyncSource("local");
        return entry;
      }
    },
    [entries, userId],
  );

  return {
    entries,
    loading,
    syncSource,
    logEmotion,
    refreshEntries,
  };
}
