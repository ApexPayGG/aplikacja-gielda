import type { NextFunction, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db";
import { getAuthenticatedUserId } from "../modules/auth/authMiddleware";

const PRO_PLUS_TIER = "PRO_PLUS";
const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export const UPGRADE_REQUIRED_RESPONSE = {
  success: false as const,
  error: "UPGRADE_REQUIRED" as const,
  message: "Autopilot autonomous execution requires a StockAI Pro+ subscription plan.",
};

type RequirePlanProPlusDeps = {
  db: Pick<PrismaClient, "user">;
};

function hasProPlusAutopilotAccess(tier: string, subscriptionStatus: string | null | undefined): boolean {
  const normalizedTier = tier.trim().toUpperCase();
  const normalizedStatus = String(subscriptionStatus ?? "")
    .trim()
    .toLowerCase();
  return normalizedTier === PRO_PLUS_TIER && ALLOWED_SUBSCRIPTION_STATUSES.has(normalizedStatus);
}

export function createRequirePlanProPlus(deps: RequirePlanProPlusDeps = { db: defaultPrisma }) {
  return async function requirePlanProPlus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await deps.db.user.findUnique({
        where: { id: userId },
        select: { tier: true, subscriptionStatus: true },
      });

      if (!user || !hasProPlusAutopilotAccess(user.tier, user.subscriptionStatus)) {
        res.status(403).json(UPGRADE_REQUIRED_RESPONSE);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requirePlanProPlus = createRequirePlanProPlus();
