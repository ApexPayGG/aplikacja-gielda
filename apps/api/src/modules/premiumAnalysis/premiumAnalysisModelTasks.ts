/**
 * Thin task - model mapping scaffold for future Premium Analysis orchestration.
 * Not a full provider router - callers still use Anthropic SDK directly today.
 */

export const PREMIUM_ANALYSIS_CONTRACT_VERSION = "1.0" as const;

export type PremiumAnalysisModelTask =
  | "executive_verdict"
  | "business_engine"
  | "valuation_context"
  | "technical_setup"
  | "scenarios"
  | "risk_map"
  | "historical_twins_summary"
  | "personal_fit"
  | "thesis_invalidators"
  | "decision_note"
  | "brief_translate";

export function resolvePremiumAnalysisModel(task: PremiumAnalysisModelTask): string {
  void task;
  const premium =
    process.env.ANTHROPIC_PREMIUM_MODEL?.trim() ||
    process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() ||
    "claude-sonnet-4-6";
  if (task === "brief_translate") {
    return process.env.AI_BRIEF_TRANSLATION_MODEL?.trim() || "claude-haiku-4-5";
  }
  return premium;
}
