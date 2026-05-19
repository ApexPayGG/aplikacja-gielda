import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./authJwt";

export type AuthenticatedRequest = Request & {
  auth: {
    userId: string;
    email: string;
  };
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = String(req.headers.authorization ?? "");
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    (req as AuthenticatedRequest).auth = {
      userId: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getAuthenticatedUserId(req: Request): string {
  return (req as AuthenticatedRequest).auth.userId;
}

export function tryGetAuthenticatedUserId(req: Request): string | null {
  return (req as AuthenticatedRequest).auth?.userId ?? null;
}

/** Attach auth when Bearer token is valid; never rejects invalid/missing tokens. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = String(req.headers.authorization ?? "");
  if (!header.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    (req as AuthenticatedRequest).auth = {
      userId: payload.sub,
      email: payload.email,
    };
  } catch {
    // Stale/invalid token — treat as anonymous (IP-based FREE quota).
  }
  next();
}
