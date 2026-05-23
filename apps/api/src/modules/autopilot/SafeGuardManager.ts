import BigNumber from "bignumber.js";
import type { AlpacaMode, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";

const MS_IN_24H = 24 * 60 * 60 * 1000;

export type AutopilotOrderSignal = {
  userId: string;
  ticker: string;
  side: "BUY" | "SELL";
  currentPrice: number;
};

export type SafeGuardRejectionCode =
  | "AUTOPILOT_DISABLED"
  | "MISSING_API_KEYS"
  | "DAILY_DRAWDOWN_COOLDOWN"
  | "INVALID_PRICE"
  | "ZERO_QUANTITY"
  | "EXCEEDS_EQUITY"
  | "SETTINGS_NOT_FOUND";

export type SafeGuardValidationResult =
  | {
      ok: true;
      calculatedQuantity: number;
      maxNotional: string;
      executionMode: AlpacaMode;
    }
  | {
      ok: false;
      code: SafeGuardRejectionCode;
      reason: string;
    };

function decimalToBigNumber(value: Prisma.Decimal | number | string): BigNumber {
  return new BigNumber(value.toString());
}

function reject(code: SafeGuardRejectionCode, reason: string): SafeGuardValidationResult {
  return { ok: false, code, reason };
}

export class SafeGuardManager {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async validateAndSizeOrder(
    signal: AutopilotOrderSignal,
    alpacaEquity: number,
  ): Promise<SafeGuardValidationResult> {
    const userId = signal.userId.trim();
    if (!userId) {
      return reject("SETTINGS_NOT_FOUND", "Missing userId");
    }

    const settings = await this.db.userAutopilotSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return reject("SETTINGS_NOT_FOUND", "User autopilot settings not configured");
    }

    if (!settings.isAutopilotEnabled) {
      return reject("AUTOPILOT_DISABLED", "Autopilot is disabled for this user");
    }

    if (!settings.alpacaApiKeyEncrypted?.trim() || !settings.alpacaApiSecretEncrypted?.trim()) {
      return reject("MISSING_API_KEYS", "Encrypted Alpaca API credentials are not configured");
    }

    const equity = new BigNumber(alpacaEquity);
    if (!equity.isFinite() || equity.lte(0)) {
      return reject("INVALID_PRICE", "Alpaca account equity must be a positive number");
    }

    const drawdownBlocked = await this.isDailyDrawdownExceeded(
      userId,
      equity,
      decimalToBigNumber(settings.maxDailyDrawdownPct),
    );
    if (drawdownBlocked) {
      return drawdownBlocked;
    }

    if (signal.side === "SELL") {
      return {
        ok: true,
        calculatedQuantity: 0,
        maxNotional: "0",
        executionMode: settings.alpacaMode,
      };
    }

    const price = new BigNumber(signal.currentPrice);
    if (!price.isFinite() || price.lte(0)) {
      return reject("INVALID_PRICE", "currentPrice must be a positive number");
    }

    const maxCapitalPct = decimalToBigNumber(settings.maxCapitalPerTradePct);
    const maxNotional = equity.multipliedBy(maxCapitalPct);
    const calculatedQuantity = maxNotional
      .dividedBy(price)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toNumber();

    if (calculatedQuantity <= 0) {
      return reject(
        "ZERO_QUANTITY",
        "Position size rounded to zero — increase equity or maxCapitalPerTradePct",
      );
    }

    const orderNotional = price.multipliedBy(calculatedQuantity);
    if (orderNotional.gt(equity)) {
      return reject(
        "EXCEEDS_EQUITY",
        "Order notional exceeds total Alpaca equity after Safe Guard sizing",
      );
    }

    return {
      ok: true,
      calculatedQuantity,
      maxNotional: maxNotional.toFixed(4),
      executionMode: settings.alpacaMode,
    };
  }

  private async isDailyDrawdownExceeded(
    userId: string,
    currentEquity: BigNumber,
    maxDailyDrawdownPct: BigNumber,
  ): Promise<SafeGuardValidationResult | null> {
    const since = new Date(Date.now() - MS_IN_24H);
    const baselineSnapshot = await this.db.portfolioSnapshot.findFirst({
      where: {
        userId,
        date: { gte: since },
      },
      orderBy: { date: "asc" },
      select: { total_value: true, date: true },
    });

    if (!baselineSnapshot) {
      return null;
    }

    const baseline = new BigNumber(baselineSnapshot.total_value);
    if (!baseline.isFinite() || baseline.lte(0)) {
      return null;
    }

    if (currentEquity.gte(baseline)) {
      return null;
    }

    const drawdownPct = baseline.minus(currentEquity).dividedBy(baseline);
    if (drawdownPct.lte(maxDailyDrawdownPct)) {
      return null;
    }

    return reject(
      "DAILY_DRAWDOWN_COOLDOWN",
      `Daily drawdown ${drawdownPct.multipliedBy(100).toFixed(2)}% exceeds limit ${maxDailyDrawdownPct.multipliedBy(100).toFixed(2)}% — cooldown active`,
    );
  }
}

export const safeGuardManager = new SafeGuardManager();
