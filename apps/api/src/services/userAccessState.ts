import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db";
import { TRIAL_RULES } from "../config/pricing";

export type StoredAccessState =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_ACTIVE"
  | "SUBSCRIPTION_TRIALING"
  | "NO_ACCESS";

export type UserAccessInput = {
  role: string;
  tier: string;
  subscriptionStatus: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialKind?: string | null;
};

export type UserAccessSnapshot = {
  tier: string;
  subscriptionStatus: string | null;
  accessState: StoredAccessState;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialKind: string | null;
  daysRemaining: number | null;
  canUseProduct: boolean;
  upgradeRequired: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeSubscriptionStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function computeDaysRemaining(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  const diffMs = trialEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / MS_PER_DAY);
}

export function getUserAccessState(input: UserAccessInput, now: Date = new Date()): UserAccessSnapshot {
  const base = {
    tier: input.tier,
    subscriptionStatus: input.subscriptionStatus,
    trialStartedAt: input.trialStartedAt,
    trialEndsAt: input.trialEndsAt,
    trialKind: input.trialKind ?? null,
  };

  if (input.role.trim().toUpperCase() === "ADMIN") {
    return {
      ...base,
      accessState: "SUBSCRIPTION_ACTIVE",
      daysRemaining: null,
      canUseProduct: true,
      upgradeRequired: false,
    };
  }

  const subStatus = normalizeSubscriptionStatus(input.subscriptionStatus);

  if (subStatus === "active") {
    return {
      ...base,
      accessState: "SUBSCRIPTION_ACTIVE",
      daysRemaining: null,
      canUseProduct: true,
      upgradeRequired: false,
    };
  }

  if (subStatus === "trialing") {
    return {
      ...base,
      accessState: "SUBSCRIPTION_TRIALING",
      daysRemaining: computeDaysRemaining(input.trialEndsAt, now),
      canUseProduct: true,
      upgradeRequired: false,
    };
  }

  if (input.trialEndsAt && input.trialEndsAt.getTime() > now.getTime()) {
    return {
      ...base,
      accessState: "TRIAL_ACTIVE",
      daysRemaining: computeDaysRemaining(input.trialEndsAt, now),
      canUseProduct: true,
      upgradeRequired: false,
    };
  }

  if (input.trialEndsAt) {
    return {
      ...base,
      accessState: "TRIAL_EXPIRED",
      daysRemaining: 0,
      canUseProduct: false,
      upgradeRequired: true,
    };
  }

  return {
    ...base,
    accessState: "NO_ACCESS",
    daysRemaining: null,
    canUseProduct: false,
    upgradeRequired: true,
  };
}

export function resolveStoredAccessState(input: UserAccessInput, now: Date = new Date()): StoredAccessState {
  return getUserAccessState(input, now).accessState;
}

export function buildRegistrationTrialWindow(now: Date = new Date()): {
  trialStartedAt: Date;
  trialEndsAt: Date;
  trialKind: "without_card";
  accessState: "TRIAL_ACTIVE";
} {
  const days = TRIAL_RULES.without_card.days;
  const trialEndsAt = new Date(now.getTime() + days * MS_PER_DAY);
  return {
    trialStartedAt: now,
    trialEndsAt,
    trialKind: "without_card",
    accessState: "TRIAL_ACTIVE",
  };
}

export type UserAccessRecord = UserAccessInput & { id: string };

const userAccessSelect = {
  id: true,
  role: true,
  tier: true,
  subscriptionStatus: true,
  trialStartedAt: true,
  trialEndsAt: true,
  trialKind: true,
} as const;

export async function getUserAccessById(
  userId: string,
  db: Pick<PrismaClient, "user"> = defaultPrisma,
): Promise<UserAccessSnapshot | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: userAccessSelect,
  });
  if (!user) return null;
  return getUserAccessState(user);
}

export async function syncUserAccessState(
  userId: string,
  db: Pick<PrismaClient, "user"> = defaultPrisma,
  now: Date = new Date(),
): Promise<StoredAccessState | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: userAccessSelect,
  });
  if (!user) return null;

  const accessState = resolveStoredAccessState(user, now);
  await db.user.update({
    where: { id: userId },
    data: { accessState },
  });
  return accessState;
}

export { userAccessSelect };
