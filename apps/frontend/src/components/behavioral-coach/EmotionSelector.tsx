import type { EmotionJournalState } from "../../utils/behavioralCoachData";
import { EMOTION_JOURNAL_LABELS } from "../../utils/behavioralCoachData";

const EMOTION_OPTIONS: EmotionJournalState[] = ["FEARFUL", "NEUTRAL", "GREEDY", "CONFIDENT"];

type Props = {
  emotion: EmotionJournalState | null;
  acknowledged: boolean;
  onSelect: (emotion: EmotionJournalState) => void;
  compact?: boolean;
};

export function EmotionSelector({ emotion, acknowledged, onSelect, compact }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
        {acknowledged ? "Aktywna emocja" : "Wybierz emocję (wymagane)"}
      </legend>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {EMOTION_OPTIONS.map((key) => {
          const meta = EMOTION_JOURNAL_LABELS[key];
          const selected = emotion === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                selected
                  ? "border-[#00C9D4]/50 bg-[#00C9D4]/15 text-white shadow-[0_0_20px_rgba(0,201,212,0.15)]"
                  : "border-white/10 bg-[#2D0A6B]/20 text-white/75 hover:border-white/20"
              }`}
            >
              <span className="block font-semibold">{meta.labelPl}</span>
              {!compact ? <span className="mt-0.5 block text-[11px] text-white/45">{meta.label}</span> : null}
            </button>
          );
        })}
      </div>
      {emotion && acknowledged ? (
        <p className="mt-2 text-xs text-[#00C9D4]/80">{EMOTION_JOURNAL_LABELS[emotion].hint}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-200/90">Paper trade i dziennik wymagają świadomego wyboru emocji.</p>
      )}
    </fieldset>
  );
}
