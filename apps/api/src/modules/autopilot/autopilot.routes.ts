import BigNumber from "bignumber.js";
import type { AlpacaMode, Prisma, PrismaClient } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { prisma as defaultPrisma } from "../../db";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import {
  requirePlanProPlus as defaultRequirePlanProPlus,
} from "../../middleware/requirePlanProPlus";
import { AutopilotCryptoService, autopilotCryptoService } from "./crypto.service";

const MAX_CAPITAL_PER_TRADE_PCT = new BigNumber("0.10");
const MIN_CAPITAL_PER_TRADE_PCT = new BigNumber("0.0001");
const MAX_DAILY_DRAWDOWN_PCT = new BigNumber("0.20");
const MIN_DAILY_DRAWDOWN_PCT = new BigNumber("0.0001");

export type AutopilotSettingsRow = {
  isAutopilotEnabled: boolean;
  alpacaMode: AlpacaMode;
  alpacaApiKeyEncrypted: string | null;
  alpacaApiSecretEncrypted: string | null;
  maxCapitalPerTradePct: Prisma.Decimal;
  maxDailyDrawdownPct: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
};

type AutopilotStatsRow = {
  totalTradesExecuted: number;
  lastExecutedAt: Date | null;
  updatedAt: Date;
};

type AutopilotRouterDeps = {
  db: Pick<PrismaClient, "userAutopilotSettings" | "userAutopilotStats">;
  crypto: Pick<AutopilotCryptoService, "encrypt">;
  requirePlanProPlus: RequestHandler;
};

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

export function hasAlpacaApiKey(
  settings: Pick<AutopilotSettingsRow, "alpacaApiKeyEncrypted"> | null,
): boolean {
  return Boolean(settings?.alpacaApiKeyEncrypted?.trim());
}

export function hasAlpacaApiSecret(
  settings: Pick<AutopilotSettingsRow, "alpacaApiSecretEncrypted"> | null,
): boolean {
  return Boolean(settings?.alpacaApiSecretEncrypted?.trim());
}

function parseAlpacaMode(raw: unknown): AlpacaMode | null {
  const normalized = String(raw ?? "").trim().toUpperCase();
  if (normalized === "PAPER") return "PAPER";
  if (normalized === "LIVE") return "LIVE";
  return null;
}

export function parseRiskPct(
  raw: unknown,
  fieldName: string,
  min: BigNumber,
  max: BigNumber,
): { ok: true; value: BigNumber } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, error: `Missing ${fieldName}` };
  }

  const value = new BigNumber(String(raw).trim());
  if (!value.isFinite()) {
    return { ok: false, error: `${fieldName} must be a finite number` };
  }
  if (value.lte(0)) {
    return { ok: false, error: `${fieldName} must be greater than 0` };
  }
  if (value.lt(min)) {
    return { ok: false, error: `${fieldName} must be at least ${min.toString()}` };
  }
  if (value.gt(max)) {
    return { ok: false, error: `${fieldName} must not exceed ${max.toString()}` };
  }

  return { ok: true, value };
}

export function serializeSettingsResponse(settings: AutopilotSettingsRow | null): {
  isAutopilotEnabled: boolean;
  alpacaMode: AlpacaMode;
  maxCapitalPerTradePct: string;
  maxDailyDrawdownPct: string;
  hasAlpacaApiKey: boolean;
  hasAlpacaApiSecret: boolean;
  createdAt: string | null;
  updatedAt: string | null;
} {
  return {
    isAutopilotEnabled: settings?.isAutopilotEnabled ?? false,
    alpacaMode: settings?.alpacaMode ?? "PAPER",
    maxCapitalPerTradePct: settings
      ? decimalToString(settings.maxCapitalPerTradePct)
      : "0.02",
    maxDailyDrawdownPct: settings
      ? decimalToString(settings.maxDailyDrawdownPct)
      : "0.05",
    hasAlpacaApiKey: hasAlpacaApiKey(settings),
    hasAlpacaApiSecret: hasAlpacaApiSecret(settings),
    createdAt: settings?.createdAt.toISOString() ?? null,
    updatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

function serializeStatsResponse(stats: AutopilotStatsRow | null): {
  totalTradesExecuted: number;
  lastExecutedAt: string | null;
  updatedAt: string | null;
} {
  return {
    totalTradesExecuted: stats?.totalTradesExecuted ?? 0,
    lastExecutedAt: stats?.lastExecutedAt?.toISOString() ?? null,
    updatedAt: stats?.updatedAt.toISOString() ?? null,
  };
}

function parseToggleEnabled(body: Record<string, unknown>): boolean | null {
  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    return typeof body.enabled === "boolean" ? body.enabled : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "isEnabled")) {
    return typeof body.isEnabled === "boolean" ? body.isEnabled : null;
  }
  return null;
}

export function createAutopilotRouter(depsInput?: Partial<AutopilotRouterDeps>): Router {
  const deps: AutopilotRouterDeps = {
    db: depsInput?.db ?? defaultPrisma,
    crypto: depsInput?.crypto ?? autopilotCryptoService,
    requirePlanProPlus: depsInput?.requirePlanProPlus ?? defaultRequirePlanProPlus,
  };

  const router = Router();
  router.use("/api/v1/autopilot", requireAuth);

  router.get("/api/v1/autopilot/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);

      const [settings, stats] = await Promise.all([
        deps.db.userAutopilotSettings.findUnique({ where: { userId } }),
        deps.db.userAutopilotStats.findUnique({ where: { userId } }),
      ]);

      res.json({
        settings: serializeSettingsResponse(settings),
        stats: serializeStatsResponse(stats),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/autopilot/settings", deps.requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const body = req.body as Record<string, unknown>;

      const hasMaxCapital = Object.prototype.hasOwnProperty.call(body, "maxCapitalPerTradePct");
      const hasMaxDrawdown = Object.prototype.hasOwnProperty.call(body, "maxDailyDrawdownPct");
      const hasAlpacaMode = Object.prototype.hasOwnProperty.call(body, "alpacaMode");

      if (!hasMaxCapital && !hasMaxDrawdown && !hasAlpacaMode) {
        res.status(400).json({ error: "At least one of maxCapitalPerTradePct, maxDailyDrawdownPct, or alpacaMode is required" });
        return;
      }

      let maxCapitalPerTradePct: BigNumber | undefined;
      if (hasMaxCapital) {
        const parsed = parseRiskPct(
          body.maxCapitalPerTradePct,
          "maxCapitalPerTradePct",
          MIN_CAPITAL_PER_TRADE_PCT,
          MAX_CAPITAL_PER_TRADE_PCT,
        );
        if (!parsed.ok) {
          res.status(400).json({ error: parsed.error });
          return;
        }
        maxCapitalPerTradePct = parsed.value;
      }

      let maxDailyDrawdownPct: BigNumber | undefined;
      if (hasMaxDrawdown) {
        const parsed = parseRiskPct(
          body.maxDailyDrawdownPct,
          "maxDailyDrawdownPct",
          MIN_DAILY_DRAWDOWN_PCT,
          MAX_DAILY_DRAWDOWN_PCT,
        );
        if (!parsed.ok) {
          res.status(400).json({ error: parsed.error });
          return;
        }
        maxDailyDrawdownPct = parsed.value;
      }

      let alpacaMode: AlpacaMode | undefined;
      if (hasAlpacaMode) {
        const parsedMode = parseAlpacaMode(body.alpacaMode);
        if (!parsedMode) {
          res.status(400).json({ error: "alpacaMode must be PAPER or LIVE" });
          return;
        }
        alpacaMode = parsedMode;
      }

      const settings = await deps.db.userAutopilotSettings.upsert({
        where: { userId },
        create: {
          userId,
          maxCapitalPerTradePct: (maxCapitalPerTradePct ?? new BigNumber("0.02")).toString(),
          maxDailyDrawdownPct: (maxDailyDrawdownPct ?? new BigNumber("0.05")).toString(),
          alpacaMode: alpacaMode ?? "PAPER",
        },
        update: {
          ...(maxCapitalPerTradePct !== undefined
            ? { maxCapitalPerTradePct: maxCapitalPerTradePct.toString() }
            : {}),
          ...(maxDailyDrawdownPct !== undefined
            ? { maxDailyDrawdownPct: maxDailyDrawdownPct.toString() }
            : {}),
          ...(alpacaMode !== undefined ? { alpacaMode } : {}),
        },
      });

      res.json({
        saved: true,
        settings: serializeSettingsResponse(settings),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/autopilot/keys", deps.requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const body = req.body as Record<string, unknown>;

      const alpacaApiKey = String(body.alpacaApiKey ?? "").trim();
      const alpacaApiSecret = String(body.alpacaApiSecret ?? "").trim();

      if (!alpacaApiKey) {
        res.status(400).json({ error: "alpacaApiKey is required" });
        return;
      }
      if (!alpacaApiSecret) {
        res.status(400).json({ error: "alpacaApiSecret is required" });
        return;
      }

      let alpacaApiKeyEncrypted: string;
      let alpacaApiSecretEncrypted: string;
      try {
        alpacaApiKeyEncrypted = deps.crypto.encrypt(alpacaApiKey);
        alpacaApiSecretEncrypted = deps.crypto.encrypt(alpacaApiSecret);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Encryption failed";
        res.status(500).json({ error: message });
        return;
      }

      const settings = await deps.db.userAutopilotSettings.upsert({
        where: { userId },
        create: {
          userId,
          alpacaApiKeyEncrypted,
          alpacaApiSecretEncrypted,
        },
        update: {
          alpacaApiKeyEncrypted,
          alpacaApiSecretEncrypted,
        },
      });

      res.json({
        success: true,
        hasAlpacaApiKey: hasAlpacaApiKey(settings),
        hasAlpacaApiSecret: hasAlpacaApiSecret(settings),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/autopilot/toggle", deps.requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const body = req.body as Record<string, unknown>;

      const enabled = parseToggleEnabled(body);
      if (enabled === null) {
        res.status(400).json({ error: "enabled must be a boolean" });
        return;
      }

      if (enabled) {
        const existing = await deps.db.userAutopilotSettings.findUnique({ where: { userId } });
        if (!hasAlpacaApiKey(existing) || !hasAlpacaApiSecret(existing)) {
          res.status(400).json({
            error: "MISSING_ALPACA_KEYS",
            message: "Alpaca API keys must be configured before enabling Autopilot",
          });
          return;
        }
      }

      const settings = await deps.db.userAutopilotSettings.upsert({
        where: { userId },
        create: {
          userId,
          isAutopilotEnabled: enabled,
        },
        update: {
          isAutopilotEnabled: enabled,
        },
      });

      res.json({
        saved: true,
        isAutopilotEnabled: settings.isAutopilotEnabled,
        hasAlpacaApiKey: hasAlpacaApiKey(settings),
        hasAlpacaApiSecret: hasAlpacaApiSecret(settings),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
