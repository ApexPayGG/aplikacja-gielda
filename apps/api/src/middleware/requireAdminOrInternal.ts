import type { NextFunction, Request, Response } from "express";

export const ADMIN_OR_INTERNAL_REQUIRED_RESPONSE = {
  success: false as const,
  error: "ADMIN_OR_INTERNAL_REQUIRED" as const,
  message: "Admin or internal access is required.",
};

type RequireAdminOrInternalDeps = {
  getEnv?: (key: string) => string | undefined;
  nodeEnv?: string;
};

type RoleCarrier = {
  role?: unknown;
  user?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAdminRole(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "ADMIN";
}

function hasAdminRoleOnObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (readAdminRole(value.role)) return true;
  if (hasAdminRoleOnObject(value.user)) return true;
  return false;
}

export function requestHasAdminRole(req: Request): boolean {
  const extended = req as Request & {
    user?: unknown;
    auth?: RoleCarrier;
  };

  if (hasAdminRoleOnObject(extended.user)) return true;

  if (isRecord(extended.auth)) {
    if (readAdminRole(extended.auth.role)) return true;
    if (hasAdminRoleOnObject(extended.auth.user)) return true;
  }

  return false;
}

export function requestHasValidInternalApiKey(
  req: Request,
  getEnv: (key: string) => string | undefined,
): boolean {
  const configured = getEnv("INTERNAL_API_KEY");
  if (!configured) return false;

  const header = req.headers["x-internal-api-key"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (provided === undefined || provided === null) return false;

  return String(provided) === configured;
}

export function requestHasDevAdminOverride(req: Request, nodeEnv: string): boolean {
  if (nodeEnv === "production") return false;

  const header = req.headers["x-dev-admin-override"];
  const provided = Array.isArray(header) ? header[0] : header;
  return String(provided ?? "").trim().toLowerCase() === "true";
}

export function createRequireAdminOrInternal(deps?: RequireAdminOrInternalDeps) {
  const getEnv = deps?.getEnv ?? ((key: string) => process.env[key]?.trim() || undefined);
  const nodeEnv = deps?.nodeEnv ?? process.env.NODE_ENV ?? "";

  return function requireAdminOrInternal(req: Request, res: Response, next: NextFunction): void {
    if (
      requestHasAdminRole(req) ||
      requestHasValidInternalApiKey(req, getEnv) ||
      requestHasDevAdminOverride(req, nodeEnv)
    ) {
      next();
      return;
    }

    res.status(403).json(ADMIN_OR_INTERNAL_REQUIRED_RESPONSE);
  };
}

export const requireAdminOrInternal = createRequireAdminOrInternal();
