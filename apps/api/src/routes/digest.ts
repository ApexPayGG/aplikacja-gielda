import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { buildDailyDigest, sendDailyDigest } from "../modules/digest/digestModule";

type DigestRouteDeps = {
  previewFn: typeof buildDailyDigest;
  sendFn: typeof sendDailyDigest;
};

const DEFAULT_USER_ID = "demo-user";

export function createDigestRouter(depsInput?: Partial<DigestRouteDeps>): Router {
  const deps: DigestRouteDeps = {
    previewFn: depsInput?.previewFn ?? buildDailyDigest,
    sendFn: depsInput?.sendFn ?? sendDailyDigest,
  };

  const router = Router();

  router.get("/api/digest/preview/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const lang = typeof req.query.lang === "string" ? req.query.lang.trim() : undefined;
      const payload = await deps.previewFn(userId, lang);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/digest/preview", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.query.userId ?? DEFAULT_USER_ID).trim();
      const lang = typeof req.query.lang === "string" ? req.query.lang.trim() : undefined;
      const payload = await deps.previewFn(userId, lang);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/digest/send/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const lang = typeof req.query.lang === "string" ? req.query.lang.trim() : undefined;
      const payload = await deps.sendFn(userId, lang);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
