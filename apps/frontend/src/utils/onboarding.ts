import { AUTH_USER_ID_STORAGE_KEY } from "../context/AuthContext";

export const ONBOARDING_STORAGE_KEY = "stockai_onboarding_preferences";

export type InvestmentStyle = "swing" | "longterm" | "daytrader" | "learning";

export type OnboardingPreferences = {
  markets: string[];
  style: InvestmentStyle;
  completedAt: string;
};

function resolveOnboardingStorageKey(): string {
  if (typeof window === "undefined") {
    return `${ONBOARDING_STORAGE_KEY}:guest`;
  }
  const userId = window.localStorage.getItem(AUTH_USER_ID_STORAGE_KEY) ?? "guest";
  return `${ONBOARDING_STORAGE_KEY}:${userId}`;
}

export function getOnboardingPreferences(): OnboardingPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const payload = window.localStorage.getItem(resolveOnboardingStorageKey());
    if (!payload) {
      return null;
    }
    return JSON.parse(payload) as OnboardingPreferences;
  } catch {
    return null;
  }
}

export function hasCompletedOnboarding(): boolean {
  const preferences = getOnboardingPreferences();
  return Boolean(preferences?.completedAt);
}

export function saveOnboardingPreferences(preferences: OnboardingPreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(resolveOnboardingStorageKey(), JSON.stringify(preferences));
}
