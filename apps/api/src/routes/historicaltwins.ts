import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { runSnapshotJob } from "../modules/historicaltwins/snapshotJob";

type HistoricalTwinsRouterDeps = {
  runSnapshotFn?: (prisma: PrismaClient) => Promise<unknown>;
};

export function createHistoricalTwinsRouter(
  prisma: PrismaClient,
  deps: HistoricalTwinsRouterDeps = {},
): Router {
  const router = Router();
  const runSnapshotFn = deps.runSnapshotFn ?? runSnapshotJob;

  router.post(
    "/api/historicaltwins/snapshot/run",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        void runSnapshotFn(prisma).catch((error) => {
          console.error("[historicaltwins] snapshot job failed", error);
        });
        res.json({ started: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
