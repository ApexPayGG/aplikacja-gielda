import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getCrowdWisdom, type CrowdWisdomResult } from "../modules/crowdwisdom/crowdWisdomModule";

type CrowdWisdomRouteDeps = {
  getCrowdWisdomFn: (symbol: string) => Promise<CrowdWisdomResult>;
};

export function createCrowdWisdomRouter(depsInput?: Partial<CrowdWisdomRouteDeps>): Router {
  const deps: CrowdWisdomRouteDeps = {
    getCrowdWisdomFn: depsInput?.getCrowdWisdomFn ?? getCrowdWisdom,
  };

  const router = Router();

  router.get("/api/crowdwisdom/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = String(req.params.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        return res.status(400).json({ error: "Missing symbol" });
      }

      const payload = await deps.getCrowdWisdomFn(symbol);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
