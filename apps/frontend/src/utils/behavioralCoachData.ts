export type CoachBias = "CUTS_WINNERS_EARLY" | "HOLDS_LOSERS_TOO_LONG" | "OVERTRADING";

export type CoachSnapshotLike = {
  biases: CoachBias[];
  avgWinPct: number;
  avgLossPct: number;
  avgHoldingWinHours: number;
  avgHoldingLossHours: number;
};

export type PsycheMetricKey = "fomoResilience" | "discipline" | "greedManagement" | "patience";

export const PSYCHE_METRIC_KEYS: PsycheMetricKey[] = [
  "fomoResilience",
  "discipline",
  "greedManagement",
  "patience",
];

export type PsycheRadarPoint = {
  metricKey: PsycheMetricKey;
  score: number;
};

export type CoachIntervention = {
  id: string;
  at: string;
  type: "revenge" | "fomo" | "overtrading" | "discipline";
  messageKey: string;
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
    { metricKey: "fomoResilience", score: fomoResilience },
    { metricKey: "discipline", score: discipline },
    { metricKey: "greedManagement", score: greedManagement },
    { metricKey: "patience", score: patience },
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
      messageKey: "coach.interventions.revengeNvda",
      savedUsd: 320,
    },
    {
      id: "int-2",
      at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      type: "fomo",
      messageKey: "coach.interventions.fomoAbbn",
    },
    {
      id: "int-3",
      at: new Date(now - 1 * day).toISOString(),
      type: "discipline",
      messageKey: "coach.interventions.disciplineSaved",
      savedUsd: 145,
    },
    {
      id: "int-4",
      at: new Date(now - 2 * day).toISOString(),
      type: "overtrading",
      messageKey: "coach.interventions.overtradingLimit",
    },
  ];

  if (biases.includes("HOLDS_LOSERS_TOO_LONG")) {
    base.unshift({
      id: "int-bias-hold",
      at: new Date(now - 3 * day).toISOString(),
      type: "discipline",
      messageKey: "coach.interventions.holdingLosers",
    });
  }

  return base.slice(0, 5);
}

export function emotionJournalStorageKey(userId: string): string {
  return `stockai:emotion-journal:${userId}`;
}
