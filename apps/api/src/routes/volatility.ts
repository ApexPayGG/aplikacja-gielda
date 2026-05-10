import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  getVolatilityHeatmap,
  type VolatilityHeatmapResponse,
} from "../modules/volatility/volatilityModule";

type VolatilityRouteDeps = {
  getVolatilityHeatmapFn: (symbol: string) => Promise<VolatilityHeatmapResponse>;
};

export function createVolatilityRouter(depsInput?: Partial<VolatilityRouteDeps>): Router {
  const deps: VolatilityRouteDeps = {
    getVolatilityHeatmapFn: depsInput?.getVolatilityHeatmapFn ?? getVolatilityHeatmap,
  };

  const router = Router();
  router.get(
    "/api/volatility/heatmap/:symbol",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const symbol = String(req.params.symbol ?? "").trim();
        if (!symbol) return res.status(400).json({ error: "Missing symbol" });
        const result = await deps.getVolatilityHeatmapFn(symbol);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
