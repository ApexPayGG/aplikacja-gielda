import { api } from "./api";

export type StoredAccessState =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_ACTIVE"
  | "SUBSCRIPTION_TRIALING"
  | "NO_ACCESS";

export type UserAccessSnapshot = {
  tier: string;
  subscriptionStatus: string | null;
  accessState: StoredAccessState;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialKind: string | null;
  daysRemaining: number | null;
  canUseProduct: boolean;
  upgradeRequired: boolean;
};

export async function fetchUserAccess(): Promise<UserAccessSnapshot> {
  const { data } = await api.get<UserAccessSnapshot>("/auth/me/access");
  return data;
}
