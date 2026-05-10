import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { explainGlossaryTerm } from "../modules/glossary/glossaryModule";

type GlossaryRouteDeps = {
  explainFn: typeof explainGlossaryTerm;
};

export function createGlossaryRouter(depsInput?: Partial<GlossaryRouteDeps>): Router {
  const deps: GlossaryRouteDeps = {
    explainFn: depsInput?.explainFn ?? explainGlossaryTerm,
  };
  const router = Router();

  router.get("/api/glossary/explain", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const term = String(req.query.term ?? "").trim();
      if (!term) return res.status(400).json({ error: "Missing term" });
      const lang = String(req.query.lang ?? "en").trim() || "en";
      const payload = await deps.explainFn(term, lang);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
