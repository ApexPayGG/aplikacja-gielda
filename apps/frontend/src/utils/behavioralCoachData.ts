export type CoachBias = "CUTS_WINNERS_EARLY" | "HOLDS_LOSERS_TOO_LONG" | "OVERTRADING";

export type CoachSnapshotLike = {
  biases: CoachBias[];
  avgWinPct: number;
  avgLossPct: number;
  avgHoldingWinHours: number;
  avgHoldingLossHours: number;
};

export type PsycheRadarPoint = {
  metric: string;
  score: number;
};

export type CoachIntervention = {
  id: string;
  at: string;
  type: "revenge" | "fomo" | "overtrading" | "discipline";
  message: string;
  savedUsd?: number;
};

export type EmotionJournalState = "FEARFUL" | "NEUTRAL" | "GREEDY" | "CONFIDENT";

export type EmotionJournalEntry = {
  id: string;
  emotion: EmotionJournalState;
  note: string;
  symbol?: string;
  createdAt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildPsycheRadarMetrics(snapshot: CoachSnapshotLike | null): PsycheRadarPoint[] {
  const biases = snapshot?.biases ?? [];
  const winHold = snapshot?.avgHoldingWinHours ?? 8;
  const lossHold = snapshot?.avgHoldingLossHours ?? 24;
  const holdRatio = lossHold > 0 ? winHold / lossHold : 0.5;

  const fomoResilience = Math.round(
    clamp(78 - (biases.includes("OVERTRADING") ? 24 : 0) - (biases.includes("CUTS_WINNERS_EARLY") ? 8 : 0), 22, 96),
  );
  const discipline = Math.round(
    clamp(70 + (snapshot?.avgWinPct ?? 3) * 2 - Math.abs(snapshot?.avgLossPct ?? -3) * 1.5 - biases.length * 7, 20, 96),
  );
  const greedManagement = Math.round(
    clamp(74 - (biases.includes("HOLDS_LOSERS_TOO_LONG") ? 26 : 0) - (biases.includes("OVERTRADING") ? 10 : 0), 22, 96),
  );
  const patience = Math.round(clamp(40 + holdRatio * 38 - (biases.includes("CUTS_WINNERS_EARLY") ? 18 : 0), 20, 96));

  return [
    { metric: "Odporność na FOMO", score: fomoResilience },
    { metric: "Dyscyplina", score: discipline },
    { metric: "Kontrola chciwości", score: greedManagement },
    { metric: "Cierpliwość", score: patience },
  ];
}

export function buildCoachInterventions(snapshot: CoachSnapshotLike | null): CoachIntervention[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const biases = snapshot?.biases ?? [];

  const base: CoachIntervention[] = [
    {
      id: "int-1",
      at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      type: "revenge",
      message:
        "Wykryto próbę Revenge Tradingu na spółce NVDA.US. Blokada transakcji na 15 minut pomogła uratować $320.",
      savedUsd: 320,
    },
    {
      id: "int-2",
      at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      type: "fomo",
      message:
        "Alert FOMO: Zamknąłeś pozycję ABBN zbyt wcześnie pod wpływem paniki rynkowej. Coach zaleca cooldown przed kolejnym wejściem.",
    },
    {
      id: "int-3",
      at: new Date(now - 1 * day).toISOString(),
      type: "discipline",
      message:
        "Dyscyplina utrzymana: odrzuciłeś 2 impulsywne wejścia poza planem. Szacowana oszczędność kapitału: $145.",
      savedUsd: 145,
    },
    {
      id: "int-4",
      at: new Date(now - 2 * day).toISOString(),
      type: "overtrading",
      message:
        "Przekroczono limit 3 transakcji dziennie. Coach włączył tryb ostrożności na kolejne 4 godziny sesji.",
    },
  ];

  if (biases.includes("HOLDS_LOSERS_TOO_LONG")) {
    base.unshift({
      id: "int-bias-hold",
      at: new Date(now - 3 * day).toISOString(),
      type: "discipline",
      message:
        "Wzorzec „trzymania przegranych” wykryty w ostatnich 12 transakcjach. Rozważ twardszy stop-loss i wcześniejsze wyjście ze strat.",
    });
  }

  return base.slice(0, 5);
}

export const EMOTION_JOURNAL_LABELS: Record<EmotionJournalState, { label: string; labelPl: string; hint: string }> = {
  FEARFUL: { label: "Fearful", labelPl: "Strach", hint: "Wysoka awersja do ryzyka — rozważ mniejszy size." },
  NEUTRAL: { label: "Neutral", labelPl: "Neutralny", hint: "Zbalansowany stan — dobry moment na plan A+." },
  GREEDY: { label: "Greedy", labelPl: "Chciwość", hint: "Ryzyko overtradingu — zweryfikuj R:R przed wejściem." },
  CONFIDENT: { label: "Confident", labelPl: "Pewność", hint: "Pewność siebie OK, ale unikaj overconfidence po serii wygranych." },
};

export function emotionJournalStorageKey(userId: string): string {
  return `stockai:emotion-journal:${userId}`;
}
