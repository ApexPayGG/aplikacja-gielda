import type { EmotionJournalState } from "../../utils/behavioralCoachData";
import { GLASS_SECTION, GLASS_SECTION_TITLE } from "./glassStyles";
import { EmotionSelector } from "./EmotionSelector";

type Props = {
  emotion: EmotionJournalState | null;
  emotionAcknowledged: boolean;
  onSelectEmotion: (emotion: EmotionJournalState) => void;
};

export function CoachEmotionHubSection({ emotion, emotionAcknowledged, onSelectEmotion }: Props) {
  return (
    <section className={GLASS_SECTION}>
      <h2 className={GLASS_SECTION_TITLE}>Centrum emocji & paper trading</h2>
      <p className="mt-1 text-sm text-white/55">
        Wybór emocji jest obowiązkowy — bez niego nie wykonasz symulowanego zlecenia ani wpisu w dzienniku.
      </p>
      <div className="mt-4">
        <EmotionSelector
          emotion={emotion}
          acknowledged={emotionAcknowledged}
          onSelect={onSelectEmotion}
        />
      </div>
    </section>
  );
}
