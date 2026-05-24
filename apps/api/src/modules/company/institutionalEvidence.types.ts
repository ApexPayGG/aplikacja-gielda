import type { MarketSignalType } from "../market-signals/marketSignals.types";

export type InstitutionalEvidenceStance = "positive" | "caution" | "neutral" | "attention";

export type InstitutionalEvidenceInterpretation = {
  stance: InstitutionalEvidenceStance;
  text: string;
  limitation: string;
};

export type InstitutionalEvidenceBlock = {
  id: string;
  signalId: string;
  signalType: MarketSignalType;
  label: string;
  source: string;
  title: string;
  summary: string | null;
  confidenceScore: number;
  eventTime: string;
  interpretation: InstitutionalEvidenceInterpretation;
};

export type DirtyTruthCategory = "insider" | "dark_pool" | "options" | "sec" | "multi_signal";

export type DirtyTruthSeverity = "low" | "medium" | "high";

export type DirtyTruthCandidate = {
  category: DirtyTruthCategory;
  severity: DirtyTruthSeverity;
  title: string;
  explanation: string;
  supportingSignalIds: string[];
};

export type InstitutionalEvidenceSummary = {
  totalSignals: number;
  averageConfidenceScore: number;
  strongestSignalType: MarketSignalType | null;
  hasInsiderBuying: boolean;
  hasInsiderSelling: boolean;
  hasWhaleAccumulation: boolean;
  hasDarkPoolActivity: boolean;
  hasOptionsFlow: boolean;
  evidenceScore: number;
};

export type InstitutionalEvidenceResponse = {
  ticker: string;
  lookbackDays: number;
  generatedAt: string;
  summary: InstitutionalEvidenceSummary;
  evidenceBlocks: InstitutionalEvidenceBlock[];
  dirtyTruthCandidates: DirtyTruthCandidate[];
  limitations: string[];
};
