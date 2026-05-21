import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { EmotionJournalEntry, EmotionJournalState } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";

const EMOTION_LABEL_DEFAULTS: Record<EmotionJournalState, string> = {
  FEARFUL: "Fearful",
  NEUTRAL: "Neutral",
  GREEDY: "Greedy",
  CONFIDENT: "Confident",
};

type Props = {
  emotion: EmotionJournalState | null;
  emotionAcknowledged: boolean;
  entries: EmotionJournalEntry[];
  entriesLoading?: boolean;
  onLogEntry: (entry: EmotionJournalEntry) => void | Promise<void>;
};

export function EmotionJournalSection({
  emotion,
  emotionAcknowledged,
  entries,
  entriesLoading = false,
  onLogEntry,
}: Props) {
  const { t, i18n } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [note, setNote] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emotionLabel = (state: EmotionJournalState) =>
    t(`coach.emotion.${state}.label`, { defaultValue: EMOTION_LABEL_DEFAULTS[state] });

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!emotion || !emotionAcknowledged) {
        setFormError(
          t("coach.journal.selectEmotionFirst", {
            defaultValue: "Select an emotion in the panel above before saving an entry.",
          }),
        );
        return;
      }

      const trimmedNote = note.trim();
      if (!trimmedNote && (emotion === "NEUTRAL" || emotion === "CONFIDENT")) {
        setFormError(
          t("coach.journal.noteRequiredNeutral", {
            defaultValue: "For Neutral / Confident, add a short note to unlock radar reinforcement.",
          }),
        );
        return;
      }

      const entry: EmotionJournalEntry = {
        id: `ej-${Date.now()}`,
        emotion,
        note: trimmedNote,
        symbol: symbol.trim().toUpperCase() || undefined,
        createdAt: new Date().toISOString(),
      };

      setSubmitting(true);
      try {
        await onLogEntry(entry);
        setNote("");
        setSymbol("");
        setFormError(null);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2200);
      } finally {
        setSubmitting(false);
      }
    },
    [emotion, emotionAcknowledged, note, onLogEntry, symbol, t],
  );

  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>{t("coach.journal.title", { defaultValue: "Emotion journal" })}</h2>
      <p className="mt-1 text-sm text-white/55">
        {t("coach.journal.subtitle", {
          defaultValue: "Add context before paper trading. Emotion is shared with the simulated orders module.",
        })}
      </p>

      {emotion && emotionAcknowledged ? (
        <p className="mt-3 rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/10 px-3 py-2 text-sm text-[#22d3ee]">
          {t("coach.journal.activeState", {
            emotion: emotionLabel(emotion),
            defaultValue: "Active state: {{emotion}}",
          })}
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t("coach.journal.unlockHint", {
            defaultValue: "Select an emotion in the section above to unlock the journal and paper trading.",
          })}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
            {t("coach.journal.tickerOptional", { defaultValue: "Ticker (optional)" })}
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t("coach.journal.tickerPlaceholder", { defaultValue: "e.g. AAPL" })}
              disabled={!emotionAcknowledged}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1e1b4b]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#22d3ee]/40 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 sm:col-span-1">
            {t("coach.journal.note", { defaultValue: "Note" })}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("coach.journal.notePlaceholder", { defaultValue: "Context before entry…" })}
              disabled={!emotionAcknowledged}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#1e1b4b]/20 px-3 py-2.5 text-sm text-white placeholder:text-white/30 backdrop-blur-md focus:border-[#22d3ee]/40 focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>

        {formError ? <p className="text-xs text-amber-200">{formError}</p> : null}

        <button
          type="submit"
          disabled={!emotionAcknowledged || !emotion || submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#22d3ee]/80 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          {savedFlash ? <CheckCircleIcon className="h-5 w-5" /> : null}
          {submitting
            ? t("coach.journal.saving", { defaultValue: "Saving…" })
            : t("coach.journal.saveCta", { defaultValue: "Save entry & update radar" })}
        </button>
      </form>

      {entriesLoading ? (
        <div className="mt-6 h-20 animate-pulse rounded-xl bg-white/5" aria-hidden />
      ) : entries.length > 0 ? (
        <ul className="mt-6 space-y-2 border-t border-white/10 pt-4">
          {entries.slice(0, 5).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="font-medium text-white/90">{emotionLabel(entry.emotion)}</span>
              {entry.symbol ? <span className="font-mono text-xs text-[#22d3ee]">{entry.symbol}</span> : null}
              <span className="text-xs text-white/45">
                {new Date(entry.createdAt).toLocaleString(i18n.language, {
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
