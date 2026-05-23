import BigNumber from "bignumber.js";
import type { AlpacaMode, Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../../db";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import { requirePlanProPlus } from "../../middleware/requirePlanProPlus";
import { autopilotCryptoService } from "./crypto.service";

const MAX_CAPITAL_PER_TRADE_PCT = new BigNumber("0.10");
const MIN_CAPITAL_PER_TRADE_PCT = new BigNumber("0.0001");
const MAX_DAILY_DRAWDOWN_PCT = new BigNumber("0.50");
const MIN_DAILY_DRAWDOWN_PCT = new BigNumber("0.0001");

type AutopilotSettingsRow = {
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

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

function hasStoredAlpacaKeys(settings: Pick<
  AutopilotSettingsRow,
  "alpacaApiKeyEncrypted" | "alpacaApiSecretEncrypted"
> | null): boolean {
  return Boolean(
    settings?.alpacaApiKeyEncrypted?.trim() && settings?.alpacaApiSecretEncrypted?.trim(),
  );
}

function parseAlpacaMode(raw: unknown): AlpacaMode | null {
  const normalized = String(raw ?? "").trim().toUpperCase();
  if (normalized === "PAPER") return "PAPER";
  if (normalized === "LIVE") return "LIVE";
  return null;
}

function parseRiskPct(
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

function serializeSettingsResponse(settings: AutopilotSettingsRow | null): {
  isAutopilotEnabled: boolean;
  alpacaMode: AlpacaMode;
  maxCapitalPerTradePct: string;
  maxDailyDrawdownPct: string;
  hasKeys: boolean;
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
    hasKeys: hasStoredAlpacaKeys(settings),
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

export function createAutopilotRouter(): Router {
  const router = Router();
  router.use("/api/v1/autopilot", requireAuth);

  router.get("/api/v1/autopilot/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);

      const [settings, stats] = await Promise.all([
        prisma.userAutopilotSettings.findUnique({ where: { userId } }),
        prisma.userAutopilotStats.findUnique({ where: { userId } }),
      ]);

      res.json({
        settings: serializeSettingsResponse(settings),
        stats: serializeStatsResponse(stats),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/autopilot/settings", requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
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

      const settings = await prisma.userAutopilotSettings.upsert({
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

  router.post("/api/v1/autopilot/keys", requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
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
        alpacaApiKeyEncrypted = autopilotCryptoService.encrypt(alpacaApiKey);
        alpacaApiSecretEncrypted = autopilotCryptoService.encrypt(alpacaApiSecret);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Encryption failed";
        res.status(500).json({ error: message });
        return;
      }

      const settings = await prisma.userAutopilotSettings.upsert({
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
        saved: true,
        hasKeys: hasStoredAlpacaKeys(settings),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/autopilot/toggle", requirePlanProPlus, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const body = req.body as Record<string, unknown>;

      if (!Object.prototype.hasOwnProperty.call(body, "isEnabled")) {
        res.status(400).json({ error: "isEnabled is required" });
        return;
      }

      if (typeof body.isEnabled !== "boolean") {
        res.status(400).json({ error: "isEnabled must be a boolean" });
        return;
      }

      const isEnabled = body.isEnabled;

      if (isEnabled) {
        const existing = await prisma.userAutopilotSettings.findUnique({ where: { userId } });
        if (!hasStoredAlpacaKeys(existing)) {
          res.status(400).json({ error: "Alpaca API keys must be configured before enabling Autopilot" });
          return;
        }
      }

      const settings = await prisma.userAutopilotSettings.upsert({
        where: { userId },
        create: {
          userId,
          isAutopilotEnabled: isEnabled,
        },
        update: {
          isAutopilotEnabled: isEnabled,
        },
      });

      res.json({
        saved: true,
        isAutopilotEnabled: settings.isAutopilotEnabled,
        hasKeys: hasStoredAlpacaKeys(settings),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
