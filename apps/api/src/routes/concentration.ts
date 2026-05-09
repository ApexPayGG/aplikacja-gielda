import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { analyzeConcentration } from "../modules/concentrationWarning/concentrationWarningModule";

export function createConcentrationRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const data = await analyzeConcentration(prisma, userId);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
