import { useTranslation } from "react-i18next";
import type { EmotionJournalState } from "../../utils/behavioralCoachData";

const EMOTION_OPTIONS: EmotionJournalState[] = ["FEARFUL", "NEUTRAL", "GREEDY", "CONFIDENT"];

const EMOTION_LABEL_DEFAULTS: Record<EmotionJournalState, string> = {
  FEARFUL: "Fearful",
  NEUTRAL: "Neutral",
  GREEDY: "Greedy",
  CONFIDENT: "Confident",
};

const EMOTION_HINT_DEFAULTS: Record<EmotionJournalState, string> = {
  FEARFUL: "High risk aversion — consider a smaller position size.",
  NEUTRAL: "Balanced state — a good moment for your A+ setup.",
  GREEDY: "Overtrading risk — verify risk/reward before entry.",
  CONFIDENT: "Confidence is fine, but watch overconfidence after a win streak.",
};

type Props = {
  emotion: EmotionJournalState | null;
  acknowledged: boolean;
  onSelect: (emotion: EmotionJournalState) => void;
  compact?: boolean;
};

export function EmotionSelector({ emotion, acknowledged, onSelect, compact }: Props) {
  const { t } = useTranslation();

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
        {acknowledged
          ? t("coach.emotion.activeLegend", { defaultValue: "Active emotion" })
          : t("coach.emotion.selectLegend", { defaultValue: "Select emotion (required)" })}
      </legend>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
        {EMOTION_OPTIONS.map((key) => {
          const selected = emotion === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`min-h-12 rounded-lg border px-3 py-3.5 text-left text-sm transition ${
                selected
                  ? "border-terminal-cyan/50 bg-terminal-cyan/15 text-terminal-text shadow-terminal-glow"
                  : "border-terminal-borderMuted bg-terminal-panelSecondary text-terminal-textSecondary hover:border-terminal-cyan/30"
              }`}
            >
              <span className="block font-semibold">
                {t(`coach.emotion.${key}.label`, { defaultValue: EMOTION_LABEL_DEFAULTS[key] })}
              </span>
            </button>
          );
        })}
      </div>
      {emotion && acknowledged ? (
        <p className="mt-2 text-xs text-terminal-cyan/80">
          {t(`coach.emotion.${emotion}.hint`, { defaultValue: EMOTION_HINT_DEFAULTS[emotion] })}
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-200/90">
          {t("coach.emotion.requiredHint", {
            defaultValue: "Paper trades and journal entries require a conscious emotion selection.",
          })}
        </p>
      )}
    </fieldset>
  );
}
