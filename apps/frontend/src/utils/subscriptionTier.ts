export type NormalizedPlan = "FREE" | "PRO" | "PRO+";

export function normalizeUserPlan(tier: string | null | undefined): NormalizedPlan {
  const normalized = (tier ?? "FREE").trim().toUpperCase();
  if (normalized.includes("PRO+") || normalized.includes("PRO_PLUS")) return "PRO+";
  if (normalized.includes("PRO")) return "PRO";
  return "FREE";
}

export function isFreePlan(tier: string | null | undefined): boolean {
  return normalizeUserPlan(tier) === "FREE";
}

export function isProPlusPlan(tier: string | null | undefined): boolean {
  return normalizeUserPlan(tier) === "PRO+";
}
