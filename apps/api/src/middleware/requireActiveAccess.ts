import type { NextFunction, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db";
import { getAuthenticatedUserId, tryGetAuthenticatedUserId } from "../modules/auth/authMiddleware";
import { getUserAccessState, userAccessSelect } from "../services/userAccessState";

export const TRIAL_EXPIRED_RESPONSE = {
  error: "TRIAL_EXPIRED" as const,
  upgradeRequired: true as const,
};

type RequireActiveAccessOptions = {
  /** When true, unauthenticated requests pass through (for optionalAuth routes). */
  allowAnonymous?: boolean;
};

type RequireActiveAccessDeps = {
  db: Pick<PrismaClient, "user">;
};

export function createRequireActiveAccess(
  deps: RequireActiveAccessDeps = { db: defaultPrisma },
  options: RequireActiveAccessOptions = {},
) {
  return async function requireActiveAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = options.allowAnonymous ? tryGetAuthenticatedUserId(req) : getAuthenticatedUserId(req);
      if (!userId) {
        if (options.allowAnonymous) {
          next();
          return;
        }
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const user = await deps.db.user.findUnique({
        where: { id: userId },
        select: userAccessSelect,
      });
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const access = getUserAccessState(user);
      if (!access.canUseProduct) {
        res.status(403).json(TRIAL_EXPIRED_RESPONSE);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireActiveAccess = createRequireActiveAccess();
export const requireActiveAccessIfAuthenticated = createRequireActiveAccess(undefined, { allowAnonymous: true });
