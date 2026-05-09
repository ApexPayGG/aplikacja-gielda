import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { calculateTax } from "../modules/taxOptimizer/taxOptimizerModule";

export function createTaxRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const rawYear = req.query.year;
      let year: number | undefined;
      if (rawYear !== undefined && rawYear !== "") {
        const y = Number.parseInt(String(rawYear), 10);
        if (!Number.isFinite(y) || y < 2000 || y > 2100) {
          return res.status(400).json({ error: "Invalid year" });
        }
        year = y;
      }
      const data = await calculateTax(prisma, userId, year);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
