export type TraderPsycheRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TraderPsycheRecommendedAction =
  | "ALLOW"
  | "WAIT_FOR_RETEST"
  | "REDUCE_SIZE"
  | "BLOCK_AND_REVIEW";

export type TraderPsycheTradeSide = "BUY" | "SELL" | "LONG" | "SHORT";

export type BehavioralFlag =
  | "FOMO_BIAS"
  | "TILT_RISK"
  | "REVENGE_TRADING"
  | "OVERTRADING"
  | "SIZE_ESCALATION"
  | "LOW_CONVICTION_CHASING";

export type NormalizedTradeRecord = {
  id: string;
  userId: string;
  ticker: string;
  side: TraderPsycheTradeSide;
  notional: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date | null;
  pnlAmount: number | null;
  pnlPct: number | null;
  signalScore: number | null;
  intradayMovePct: number | null;
  fundamentalsChecked: boolean | null;
};

export type PreTradeCheckInput = {
  ticker: string;
  side: TraderPsycheTradeSide;
  intendedNotional?: number;
  signalScore?: number;
  intradayMovePct?: number;
  fundamentalsChecked?: boolean;
};

export type BehavioralAnalysisResult = {
  userId: string;
  ticker: string | null;
  score: number;
  riskLevel: TraderPsycheRiskLevel;
  flags: BehavioralFlag[];
  warnings: string[];
  recommendedAction: TraderPsycheRecommendedAction;
  lookbackDays: number;
  tradeCount: number;
};

export type TraderPsycheStatsResponse = Omit<BehavioralAnalysisResult, "ticker"> & {
  ticker: null;
};

export type PreTradeCheckResponse = BehavioralAnalysisResult;
