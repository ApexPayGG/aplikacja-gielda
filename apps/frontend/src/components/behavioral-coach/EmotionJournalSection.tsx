import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  EMOTION_JOURNAL_LABELS,
  type EmotionJournalEntry,
  type EmotionJournalState,
  emotionJournalStorageKey,
} from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";

const EMOTION_OPTIONS: EmotionJournalState[] = ["FEARFUL", "NEUTRAL", "GREEDY", "CONFIDENT"];

type Props = {
  userId: string;
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

export function EmotionJournalSection({ userId }: Props) {
  const storageKey = emotionJournalStorageKey(userId);
  const [emotion, setEmotion] = useState<EmotionJournalState>("NEUTRAL");
  const [symbol, setSymbol] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<EmotionJournalEntry[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setEntries(readEntries(storageKey));
  }, [storageKey]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const entry: EmotionJournalEntry = {
        id: `ej-${Date.now()}`,
        emotion,
        note: note.trim(),
        symbol: symbol.trim().toUpperCase() || undefined,
        createdAt: new Date().toISOString(),
      };
      const next = [entry, ...readEntries(storageKey)].slice(0, 12);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setEntries(next);
      setNote("");
      setSymbol("");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2200);
    },
    [emotion, note, symbol, storageKey],
  );

  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>Dziennik Emocji</h2>
      <p className="mt-1 text-sm text-white/55">
        Zaloguj stan emocjonalny przed transakcją paper — Coach wykorzysta to w kolejnych interwencjach.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Jak się czujesz?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EMOTION_OPTIONS.map((key) => {
              const meta = EMOTION_JOURNAL_LABELS[key];
              const selected = emotion === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEmotion(key)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                    selected
                      ? "border-[#00C9D4]/50 bg-[#00C9D4]/15 text-white shadow-[0_0_20px_rgba(0,201,212,0.15)]"
                      : "border-white/10 bg-[#2D0A6B]/20 text-white/75 hover:border-white/20"
                  }`}
                >
                  <span className="block font-semibold">{meta.labelPl}</span>
                  <span className="mt-0.5 block text-[11px] text-white/45">{meta.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#00C9D4]/80">{EMOTION_JOURNAL_LABELS[emotion].hint}</p>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
            Ticker (opcjonalnie)
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="np. ABBN"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#2D0A6B]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#00C9D4]/40 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 sm:col-span-1">
            Notatka
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kontekst przed wejściem..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#2D0A6B]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#00C9D4]/40 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2D0A6B] to-[#00C9D4]/80 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 sm:w-auto"
        >
          {savedFlash ? <CheckCircleIcon className="h-5 w-5" /> : null}
          Zapisz wpis przed paper trade
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
                {new Date(entry.createdAt).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
