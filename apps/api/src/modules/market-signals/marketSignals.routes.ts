import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { requireAdminOrInternal } from "../../middleware/requireAdminOrInternal";
import { getAuthenticatedUserId, requireAuth } from "../auth/authMiddleware";
import {
  createMarketSignalIngestionService,
  parseMarketSignalProvider,
} from "./marketSignals.ingestion";
import type { MarketSignalIngestionService } from "./marketSignals.ingestion";
import { enqueueProviderPayload } from "./marketSignals.queue";
import type { MarketSignalsQueueAddInput, MarketSignalEnqueueResult } from "./marketSignals.queue";
import {
  fetchAndEnqueueMarketSignal,
  normalizeFetchTicker,
} from "./marketSignals.fetchers";
import type { MarketSignalFetchEnqueueResult, MarketSignalsOpsHealthResponse } from "./marketSignals.types";
import { buildMarketSignalsOpsHealth } from "./marketSignals.ops";
import {
  clampLookbackDays,
  MarketSignalsService,
  marketSignalsService,
  parseMarketSignalIngestInput,
  parseMarketSignalType,
} from "./marketSignals.service";

type MarketSignalsRouterDeps = {
  service: MarketSignalsService;
  ingestionService: MarketSignalIngestionService;
  enqueueProviderPayload: (input: MarketSignalsQueueAddInput) => Promise<MarketSignalEnqueueResult>;
  fetchAndEnqueueMarketSignal: (input: {
    provider: string;
    ticker: string;
    requestedByUserId?: string;
    reason?: string;
  }) => Promise<MarketSignalFetchEnqueueResult>;
  requireAuthMiddleware: typeof requireAuth;
  requireAdminOrInternalMiddleware: typeof requireAdminOrInternal;
  getOpsHealth?: () => Promise<MarketSignalsOpsHealthResponse>;
};

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function createMarketSignalsRouter(depsInput?: Partial<MarketSignalsRouterDeps>): Router {
  const service = depsInput?.service ?? marketSignalsService;
  const deps: MarketSignalsRouterDeps = {
    service,
    ingestionService:
      depsInput?.ingestionService ??
      createMarketSignalIngestionService({ marketSignalService: service }),
    enqueueProviderPayload: depsInput?.enqueueProviderPayload ?? enqueueProviderPayload,
    fetchAndEnqueueMarketSignal: depsInput?.fetchAndEnqueueMarketSignal ?? fetchAndEnqueueMarketSignal,
    requireAuthMiddleware: depsInput?.requireAuthMiddleware ?? requireAuth,
    requireAdminOrInternalMiddleware:
      depsInput?.requireAdminOrInternalMiddleware ?? requireAdminOrInternal,
    getOpsHealth: depsInput?.getOpsHealth ?? buildMarketSignalsOpsHealth,
  };

  const writeGuard = deps.requireAdminOrInternalMiddleware;

  const router = Router();
  router.use("/api/v1/market-signals", deps.requireAuthMiddleware);

  router.get(
    "/api/v1/market-signals/ops/health",
    writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        void getAuthenticatedUserId(req);
        const result = await deps.getOpsHealth!();
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/v1/market-signals/:ticker", async (req: Request, res: Response, next: NextFunction) => {
    try {
      void getAuthenticatedUserId(req);
      const ticker = String(req.params.ticker ?? "").trim();
      if (!ticker) {
        res.status(400).json({ error: "ticker is required" });
        return;
      }

      const lookbackDays = clampLookbackDays(parseOptionalNumber(req.query.lookbackDays));
      const minConfidence = parseOptionalNumber(req.query.minConfidence) ?? 0;
      const signalTypeRaw = req.query.signalType;
      const signalType =
        signalTypeRaw === undefined || signalTypeRaw === ""
          ? undefined
          : parseMarketSignalType(signalTypeRaw);

      if (signalTypeRaw !== undefined && signalTypeRaw !== "" && !signalType) {
        res.status(400).json({ error: "signalType must be a supported institutional signal type" });
        return;
      }

      const result = await deps.service.listSignals({
        ticker,
        lookbackDays,
        minConfidence,
        signalType: signalType ?? undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/v1/market-signals/ingest",
    writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
    try {
      void getAuthenticatedUserId(req);
      const parsed = parseMarketSignalIngestInput(req.body as Record<string, unknown>, new Date());
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const result = await deps.service.ingestSignal(parsed.value);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
  );

  router.post(
    "/api/v1/market-signals/provider-ingest",
    writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        void getAuthenticatedUserId(req);
        const body = req.body as Record<string, unknown>;
        const provider = parseMarketSignalProvider(body.provider);
        if (!provider) {
          res.status(400).json({ error: "provider must be a supported market signal provider" });
          return;
        }
        if (body.payload === undefined) {
          res.status(400).json({ error: "payload is required" });
          return;
        }

        const result = await deps.ingestionService.ingestProviderPayload(provider, body.payload);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/market-signals/provider-enqueue",
    writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        const body = req.body as Record<string, unknown>;
        const provider = parseMarketSignalProvider(body.provider);
        if (!provider) {
          res.status(400).json({ error: "provider must be a supported market signal provider" });
          return;
        }
        if (body.payload === undefined) {
          res.status(400).json({ error: "payload is required" });
          return;
        }

        const reasonRaw = body.reason;
        const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : undefined;

        const result = await deps.enqueueProviderPayload({
          provider,
          payload: body.payload,
          requestedByUserId: userId,
          reason: reason || undefined,
        });
        res.status(202).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/market-signals/provider-fetch-enqueue",
    writeGuard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = getAuthenticatedUserId(req);
        const body = req.body as Record<string, unknown>;
        const provider = parseMarketSignalProvider(body.provider);
        if (!provider) {
          res.status(400).json({ error: "provider must be a supported market signal provider" });
          return;
        }

        const tickerRaw = String(body.ticker ?? "").trim();
        if (!tickerRaw) {
          res.status(400).json({ error: "ticker is required" });
          return;
        }
        if (!normalizeFetchTicker(tickerRaw)) {
          res.status(400).json({ error: "ticker must match /^[A-Z0-9.\\-]{1,16}$/i" });
          return;
        }

        const reasonRaw = body.reason;
        const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : undefined;

        const result = await deps.fetchAndEnqueueMarketSignal({
          provider,
          ticker: tickerRaw,
          requestedByUserId: userId,
          reason: reason || undefined,
        });

        if (!result.queued && result.errorCode === "INVALID_TICKER") {
          res.status(400).json({ error: "ticker must match /^[A-Z0-9.\\-]{1,16}$/i" });
          return;
        }

        res.status(result.queued ? 202 : 200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
