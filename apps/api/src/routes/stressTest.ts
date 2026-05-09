import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { runStressTest } from "../modules/stressTest/stressTestModule";

export function createStressTestRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const raw = req.query.customDrop;
      let customDrop: number | undefined;
      if (raw !== undefined && raw !== null && String(raw) !== "") {
        customDrop = Number(raw);
        if (!Number.isFinite(customDrop) || customDrop < 0 || customDrop > 100) {
          return res.status(400).json({ error: "customDrop must be a number between 0 and 100" });
        }
      }

      const data = await runStressTest(prisma, userId, customDrop);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
