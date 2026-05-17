import type { NextFunction, Request, RequestHandler, Response } from "express";

const FIELD_LENGTH_LIMITS: Record<string, number> = {
  email: 255,
  password: 128,
  name: 100,
};

class InputValidationError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validateLength(fieldName: string | null, value: string): void {
  if (!fieldName) return;
  const limit = FIELD_LENGTH_LIMITS[fieldName.toLowerCase()];
  if (typeof limit !== "number") return;
  if (value.length > limit) {
    throw new InputValidationError(`Field "${fieldName}" exceeds max length ${limit}.`);
  }
}

function sanitizeUnknown(value: unknown, fieldName: string | null): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    validateLength(fieldName, trimmed);
    return escapeHtml(trimmed);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item, fieldName));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = sanitizeUnknown(nested, key);
    }
    return result;
  }

  return value;
}

function sanitizeRequest(req: Request): void {
  (req as Request & { body: unknown }).body = sanitizeUnknown((req as Request & { body: unknown }).body, null);
  (req as Request & { query: unknown }).query = sanitizeUnknown(req.query, null) as Request["query"];
  const sanitizedParams = sanitizeUnknown(req.params, null) as Record<string, string>;
  Object.assign(req.params, sanitizedParams);
}

export function createInputSanitizerMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/api/stripe/webhook") {
      next();
      return;
    }

    try {
      sanitizeRequest(req);
      next();
    } catch (error) {
      if (error instanceof InputValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };
}
