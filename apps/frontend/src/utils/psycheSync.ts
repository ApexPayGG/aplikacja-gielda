import type { EmotionJournalState } from "./behavioralCoachData";
import type { StoredPsycheScores } from "./coachPaperTrading";

export type PsycheApiScores = {
  fomoScore: number;
  discipline: number;
  greedControl: number;
  patience: number;
  growthScore: number;
  createdAt?: string | null;
};

export type PsycheHistoryPoint = PsycheApiScores & {
  id: string;
  createdAt: string;
};

export type SyncSource = "api" | "local";

const PSYCHE_LOCAL_PREFIX = "psyche_";

export function psycheLocalStorageKey(userId: string): string {
  return `${PSYCHE_LOCAL_PREFIX}${userId}`;
}

export function apiEmotionFromJournal(emotion: EmotionJournalState): "FEAR" | "NEUTRAL" | "GREED" | "CONFIDENCE" {
  switch (emotion) {
    case "FEARFUL":
      return "FEAR";
    case "GREEDY":
      return "GREED";
    case "CONFIDENT":
      return "CONFIDENCE";
    default:
      return "NEUTRAL";
  }
}

export function journalEmotionFromApi(emotion: string): EmotionJournalState {
  switch (String(emotion).toUpperCase()) {
    case "FEAR":
      return "FEARFUL";
    case "GREED":
      return "GREEDY";
    case "CONFIDENCE":
      return "CONFIDENT";
    default:
      return "NEUTRAL";
  }
}

export function storedScoresToApi(scores: StoredPsycheScores): PsycheApiScores {
  const growthScore = Math.round(
    (scores.fomoResilience + scores.discipline + scores.greedManagement + scores.patience) / 4,
  );
  return {
    fomoScore: scores.fomoResilience,
    discipline: scores.discipline,
    greedControl: scores.greedManagement,
    patience: scores.patience,
    growthScore,
  };
}

export function apiScoresToStored(scores: PsycheApiScores): StoredPsycheScores {
  return {
    fomoResilience: scores.fomoScore,
    discipline: scores.discipline,
    greedManagement: scores.greedControl,
    patience: scores.patience,
    updatedAt: scores.createdAt ?? new Date().toISOString(),
  };
}

export const DEFAULT_PSYCHE_API: PsycheApiScores = {
  fomoScore: 50,
  discipline: 50,
  greedControl: 50,
  patience: 50,
  growthScore: 50,
};
