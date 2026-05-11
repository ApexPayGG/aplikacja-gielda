import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { calculateTaxBySystem, listTaxSystems } from "../modules/tax/taxModule";

export function createTaxRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/systems", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ systems: listTaxSystems() });
    } catch (e) {
      next(e);
    }
  });

  router.post("/calculate", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        userId?: string;
        country?: string;
        trades?: Array<{ ticker: string; openDate: string; closeDate: string; pnl: number; pnlPct: number }>;
        customRate?: number;
      };
      const userId = String(body.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const country = String(body.country ?? "").trim().toUpperCase();
      if (!country) return res.status(400).json({ error: "Missing country" });
      let result;
      try {
        result = await calculateTaxBySystem(prisma, {
          userId,
          country,
          trades: Array.isArray(body.trades) ? body.trades : undefined,
          customRate: body.customRate,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Calculation error";
        return res.status(400).json({ error: msg });
      }
      res.json({
        grossGains: result.grossGains,
        losses: result.losses,
        netIncome: result.netIncome,
        taxRate: result.taxRate,
        taxDue: result.taxDue,
        taxName: result.taxName,
        form: result.form,
        note: result.note,
        currency: result.currency,
        country: result.country,
        countryName: result.countryName,
        trades: result.trades,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
