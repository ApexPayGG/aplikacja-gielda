import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/index";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

type UserProfileRecord = {
  id: string;
  email: string;
  name: string | null;
  language: string | null;
  timezone: string | null;
  avatarUrl: string | null;
  tier: string;
  lastLoginAt: Date | null;
};

type UpdateUserProfileInput = {
  name?: string | null;
  language?: string;
  timezone?: string;
  avatar?: string | null;
};

type UserProfileRouteDeps = {
  getProfileFn: (userId: string) => Promise<UserProfileRecord | null>;
  updateProfileFn: (userId: string, input: UpdateUserProfileInput) => Promise<UserProfileRecord>;
};

const userProfileSelect = {
  id: true,
  email: true,
  name: true,
  language: true,
  timezone: true,
  avatarUrl: true,
  tier: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

const defaultDeps: UserProfileRouteDeps = {
  getProfileFn: async (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    }),
  updateProfileFn: async (userId, input) => {
    const updates: Prisma.UserUpdateInput = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.language !== undefined) updates.language = input.language;
    if (input.timezone !== undefined) updates.timezone = input.timezone;
    if (input.avatar !== undefined) updates.avatarUrl = input.avatar;

    if (Object.keys(updates).length === 0) {
      const profile = await prisma.user.findUnique({
        where: { id: userId },
        select: userProfileSelect,
      });
      if (!profile) {
        throw new Error("User not found");
      }
      return profile;
    }

    return prisma.user.update({
      where: { id: userId },
      data: updates,
      select: userProfileSelect,
    });
  },
};

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  return value.trim();
}

function toProfileResponse(profile: UserProfileRecord): {
  id: string;
  email: string;
  name: string | null;
  language: string | null;
  timezone: string | null;
  avatarUrl: string | null;
  tier: string;
  lastLoginAt: string | null;
} {
  return {
    ...profile,
    lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
  };
}

export function createUserProfileRouter(depsInput?: Partial<UserProfileRouteDeps>): Router {
  const deps: UserProfileRouteDeps = {
    getProfileFn: depsInput?.getProfileFn ?? defaultDeps.getProfileFn,
    updateProfileFn: depsInput?.updateProfileFn ?? defaultDeps.updateProfileFn,
  };

  const router = Router();

  router.get("/api/user/profile/:userId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }
      if (getAuthenticatedUserId(req) !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const profile = await deps.getProfileFn(userId);
      if (!profile) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({ profile: toProfileResponse(profile) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/user/profile/:userId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        res.status(400).json({ error: "Missing userId" });
        return;
      }
      if (getAuthenticatedUserId(req) !== userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = parseOptionalString(body.name);
      const language = parseOptionalString(body.language);
      const timezone = parseOptionalString(body.timezone);
      const avatar = parseOptionalString(body.avatar);

      if (body.name !== undefined && typeof body.name !== "string" && body.name !== null) {
        res.status(400).json({ error: "name must be a string or null" });
        return;
      }
      if (body.language !== undefined && typeof body.language !== "string") {
        res.status(400).json({ error: "language must be a string" });
        return;
      }
      if (body.timezone !== undefined && typeof body.timezone !== "string") {
        res.status(400).json({ error: "timezone must be a string" });
        return;
      }
      if (body.avatar !== undefined && typeof body.avatar !== "string" && body.avatar !== null) {
        res.status(400).json({ error: "avatar must be a string or null" });
        return;
      }

      if (language === "") {
        res.status(400).json({ error: "language cannot be empty" });
        return;
      }
      if (timezone === "") {
        res.status(400).json({ error: "timezone cannot be empty" });
        return;
      }

      const profile = await deps.updateProfileFn(userId, {
        name: body.name === undefined ? undefined : body.name === null ? null : name ?? null,
        language: language === undefined ? undefined : language,
        timezone: timezone === undefined ? undefined : timezone,
        avatar: body.avatar === undefined ? undefined : body.avatar === null ? null : avatar ?? null,
      });

      res.json({ profile: toProfileResponse(profile) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (error instanceof Error && error.message === "User not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
