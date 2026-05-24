import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import { marketSignalsService } from "../market-signals/marketSignals.service";
import { normalizeFetchTicker } from "../market-signals/marketSignals.fetchers";
import {
  clampInstitutionalLookbackDays,
  clampInstitutionalMinConfidence,
  getInstitutionalEvidence,
} from "./institutionalEvidence.service";
import type { InstitutionalEvidenceResponse } from "./institutionalEvidence.types";

type CompanyRouterDeps = {
  requireAuthMiddleware: typeof requireAuth;
  getInstitutionalEvidence: typeof getInstitutionalEvidence;
};

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function createCompanyRouter(depsInput?: Partial<CompanyRouterDeps>): Router {
  const deps: CompanyRouterDeps = {
    requireAuthMiddleware: depsInput?.requireAuthMiddleware ?? requireAuth,
    getInstitutionalEvidence:
      depsInput?.getInstitutionalEvidence ??
      ((input) =>
        getInstitutionalEvidence(input, {
          listSignals: (params) => marketSignalsService.listSignals(params),
        })),
  };

  const router = Router();

  router.get(
    "/api/v1/company/:ticker/institutional-evidence",
    deps.requireAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        void getAuthenticatedUserId(req);
        const tickerRaw = String(req.params.ticker ?? "").trim();
        if (!normalizeFetchTicker(tickerRaw)) {
          res.status(400).json({ error: "ticker must match /^[A-Z0-9.\\-]{1,16}$/i" });
          return;
        }

        const lookbackDays = clampInstitutionalLookbackDays(parseOptionalNumber(req.query.lookbackDays));
        const minConfidence = clampInstitutionalMinConfidence(parseOptionalNumber(req.query.minConfidence));

        const result: InstitutionalEvidenceResponse = await deps.getInstitutionalEvidence({
          ticker: tickerRaw,
          lookbackDays,
          minConfidence,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
