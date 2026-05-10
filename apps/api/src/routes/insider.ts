import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getInsiderMirror, type InsiderMirrorResult } from "../modules/insider/insiderMirrorModule";

type InsiderRouteDeps = {
  getInsiderMirrorFn: (symbol: string) => Promise<InsiderMirrorResult>;
};

export function createInsiderRouter(depsInput?: Partial<InsiderRouteDeps>): Router {
  const deps: InsiderRouteDeps = {
    getInsiderMirrorFn: depsInput?.getInsiderMirrorFn ?? getInsiderMirror,
  };

  const router = Router();

  router.get("/api/insider/:symbol", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbol = String(req.params.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        return res.status(400).json({ error: "Missing symbol" });
      }

      const payload = await deps.getInsiderMirrorFn(symbol);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
