import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getDiscordWebhook, saveDiscordWebhook, sendDiscordTest } from "../modules/discord/autoSyncModule";

type DiscordSyncDeps = {
  saveFn: typeof saveDiscordWebhook;
  getFn: typeof getDiscordWebhook;
  testFn: typeof sendDiscordTest;
};

export function createDiscordSyncRouter(depsInput?: Partial<DiscordSyncDeps>): Router {
  const deps: DiscordSyncDeps = {
    saveFn: depsInput?.saveFn ?? saveDiscordWebhook,
    getFn: depsInput?.getFn ?? getDiscordWebhook,
    testFn: depsInput?.testFn ?? sendDiscordTest,
  };

  const router = Router();

  router.post("/api/discord/webhook/save", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, webhookUrl } = req.body as Record<string, unknown>;
      if (!userId || !webhookUrl) {
        return res.status(400).json({ error: "Missing required fields: userId, webhookUrl" });
      }
      const saved = await deps.saveFn(String(userId), String(webhookUrl));
      res.json({ saved });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/discord/webhook/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const webhookUrl = await deps.getFn(userId);
      res.json({ webhookUrl });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/discord/webhook/test/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const sent = await deps.testFn(userId);
      res.json({ sent });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
