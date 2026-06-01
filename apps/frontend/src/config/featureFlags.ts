/** Premium Analysis orchestrator UI (GET /api/premium/:ticker/analysis). Default OFF. */
export function isPremiumAnalysisV2Enabled(): boolean {
  if (typeof import.meta.env.VITE_PREMIUM_ANALYSIS_V2_ENABLED === "string") {
    if (import.meta.env.VITE_PREMIUM_ANALYSIS_V2_ENABLED.trim().toLowerCase() === "true") {
      return true;
    }
  }
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem("stockai.premiumAnalysisV2") === "true";
    } catch {
      return false;
    }
  }
  return false;
}
