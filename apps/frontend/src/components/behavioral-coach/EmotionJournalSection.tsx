import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  EMOTION_JOURNAL_LABELS,
  type EmotionJournalEntry,
  type EmotionJournalState,
  emotionJournalStorageKey,
} from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";

type Props = {
  userId: string;
  emotion: EmotionJournalState | null;
  emotionAcknowledged: boolean;
  onLogEntry: (entry: EmotionJournalEntry) => void;
};

function readEntries(key: string): EmotionJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(key);
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

export function EmotionJournalSection({ userId, emotion, emotionAcknowledged, onLogEntry }: Props) {
  const storageKey = emotionJournalStorageKey(userId);
  const [symbol, setSymbol] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<EmotionJournalEntry[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readEntries(storageKey));
  }, [storageKey]);

  const refreshEntries = useCallback(() => {
    setEntries(readEntries(storageKey));
  }, [storageKey]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!emotion || !emotionAcknowledged) {
        setFormError("Wybierz emocję w panelu powyżej przed zapisem wpisu.");
        return;
      }

      const trimmedNote = note.trim();
      if (!trimmedNote && (emotion === "NEUTRAL" || emotion === "CONFIDENT")) {
        setFormError("Dla Neutral / Pewność dodaj krótką notatkę, aby odblokować wzmocnienie radaru.");
        return;
      }

      const entry: EmotionJournalEntry = {
        id: `ej-${Date.now()}`,
        emotion,
        note: trimmedNote,
        symbol: symbol.trim().toUpperCase() || undefined,
        createdAt: new Date().toISOString(),
      };

      onLogEntry(entry);
      refreshEntries();
      setNote("");
      setSymbol("");
      setFormError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
    },
    [emotion, emotionAcknowledged, note, onLogEntry, refreshEntries, symbol],
  );

  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>Dziennik Emocji</h2>
      <p className="mt-1 text-sm text-white/55">
        Uzupełnij kontekst przed paper trade. Emocja jest wspólna z modułem zleceń symulowanych.
      </p>

      {emotion && emotionAcknowledged ? (
        <p className="mt-3 rounded-xl border border-[#00C9D4]/25 bg-[#00C9D4]/10 px-3 py-2 text-sm text-[#00C9D4]">
          Aktywny stan: <span className="font-semibold">{EMOTION_JOURNAL_LABELS[emotion].labelPl}</span>
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Wybierz emocję w sekcji powyżej, aby odblokować dziennik i paper trading.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
            Ticker (opcjonalnie)
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="np. ABBN"
              disabled={!emotionAcknowledged}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#2D0A6B]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#00C9D4]/40 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 sm:col-span-1">
            Notatka
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kontekst przed wejściem..."
              disabled={!emotionAcknowledged}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#2D0A6B]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#00C9D4]/40 focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>

        {formError ? <p className="text-xs text-amber-200">{formError}</p> : null}

        <button
          type="submit"
          disabled={!emotionAcknowledged || !emotion}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2D0A6B] to-[#00C9D4]/80 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {savedFlash ? <CheckCircleIcon className="h-5 w-5" /> : null}
          Zapisz wpis i zaktualizuj radar
        </button>
      </form>

      {entries.length > 0 ? (
        <ul className="mt-6 space-y-2 border-t border-white/10 pt-4">
          {entries.slice(0, 5).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="font-medium text-white/90">{EMOTION_JOURNAL_LABELS[entry.emotion].labelPl}</span>
              {entry.symbol ? <span className="font-mono text-xs text-[#00C9D4]">{entry.symbol}</span> : null}
              <span className="text-xs text-white/45">
                {new Date(entry.createdAt).toLocaleString("pl-PL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
