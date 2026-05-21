import { useTranslation } from "react-i18next";
import type { EmotionJournalState } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";
import { EmotionSelector } from "./EmotionSelector";

type Props = {
  emotion: EmotionJournalState | null;
  emotionAcknowledged: boolean;
  onSelectEmotion: (emotion: EmotionJournalState) => void;
};

export function CoachEmotionHubSection({ emotion, emotionAcknowledged, onSelectEmotion }: Props) {
  const { t } = useTranslation();

  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>
        {t("coach.emotionHub.title", { defaultValue: "Emotion center & paper trading" })}
      </h2>
      <p className="mt-1 text-sm text-white/55">
        {t("coach.emotionHub.subtitle", {
          defaultValue: "Emotion selection is required — you cannot place a simulated order or journal entry without it.",
        })}
      </p>
      <div className="mt-4">
        <EmotionSelector emotion={emotion} acknowledged={emotionAcknowledged} onSelect={onSelectEmotion} />
      </div>
    </section>
  );
}
