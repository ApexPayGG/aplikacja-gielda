import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getNewsHalfLife, type NewsHalfLifeResponse } from "../modules/newshalflife/newsHalfLifeModule";

type NewsHalfLifeRouteDeps = {
  getNewsHalfLifeFn: (symbol: string) => Promise<NewsHalfLifeResponse>;
};

export function createNewsHalfLifeRouter(depsInput?: Partial<NewsHalfLifeRouteDeps>): Router {
  const deps: NewsHalfLifeRouteDeps = {
    getNewsHalfLifeFn: depsInput?.getNewsHalfLifeFn ?? getNewsHalfLife,
  };

  const router = Router();
  router.get("/api/news/halflife/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = String(req.params.symbol ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      const result = await deps.getNewsHalfLifeFn(symbol);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
