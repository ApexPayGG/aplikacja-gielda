import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import {
  normalizeTradeSide,
  TraderPsycheService,
  traderPsycheService,
} from "./traderPsyche.service";
import type { PreTradeCheckInput } from "./traderPsyche.types";

type TraderPsycheRouterDeps = {
  service: TraderPsycheService;
  requireAuthMiddleware: typeof requireAuth;
};

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parsePreTradeCheckBody(body: Record<string, unknown>): PreTradeCheckInput | { error: string } {
  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  const side = normalizeTradeSide(String(body.side ?? ""));

  if (!ticker) return { error: "ticker is required" };
  if (!side) return { error: "side must be BUY, SELL, LONG, or SHORT" };

  const intendedNotional = parseOptionalNumber(body.intendedNotional);
  const signalScore = parseOptionalNumber(body.signalScore);
  const intradayMovePct = parseOptionalNumber(body.intradayMovePct);

  if (body.fundamentalsChecked !== undefined && typeof body.fundamentalsChecked !== "boolean") {
    return { error: "fundamentalsChecked must be a boolean when provided" };
  }

  return {
    ticker,
    side,
    intendedNotional,
    signalScore,
    intradayMovePct,
    fundamentalsChecked:
      typeof body.fundamentalsChecked === "boolean" ? body.fundamentalsChecked : undefined,
  };
}

export function createTraderPsycheRouter(depsInput?: Partial<TraderPsycheRouterDeps>): Router {
  const deps: TraderPsycheRouterDeps = {
    service: depsInput?.service ?? traderPsycheService,
    requireAuthMiddleware: depsInput?.requireAuthMiddleware ?? requireAuth,
  };

  const router = Router();
  router.use("/api/v1/trader-psyche", deps.requireAuthMiddleware);

  router.get("/api/v1/trader-psyche/stats", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const lookbackDays = parseOptionalNumber(req.query.lookbackDays);
      const stats = await deps.service.getStats(userId, lookbackDays);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/v1/trader-psyche/pre-trade-check",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        const parsed = parsePreTradeCheckBody(req.body as Record<string, unknown>);
        if ("error" in parsed) {
          res.status(400).json({ error: parsed.error });
          return;
        }

        const result = await deps.service.preTradeCheck(userId, parsed);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
