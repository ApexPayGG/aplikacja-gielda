import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  calculatePositionSize,
  type ConvictionLevel,
} from "../modules/positionSize/positionSizeModule";

function parseConviction(v: unknown): ConvictionLevel | null {
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH") return v;
  return null;
}

export function createPositionSizeRouter(_prisma: PrismaClient): Router {
  const router = Router();

  router.post("/calculate", (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const accountSize = Number(body.accountSize);
      const riskPercent = body.riskPercent === undefined || body.riskPercent === null ? 2 : Number(body.riskPercent);
      const entryPrice = Number(body.entryPrice);
      const stopLossPrice = Number(body.stopLossPrice);
      const conviction = parseConviction(body.conviction);

      if (!Number.isFinite(accountSize) || !Number.isFinite(entryPrice) || !Number.isFinite(stopLossPrice)) {
        return res.status(400).json({ error: "accountSize, entryPrice, and stopLossPrice must be numbers" });
      }
      if (!conviction) {
        return res.status(400).json({ error: "conviction must be LOW, MEDIUM, or HIGH" });
      }
      if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) {
        return res.status(400).json({ error: "riskPercent must be between 0 and 100" });
      }

      const result = calculatePositionSize({
        accountSize,
        riskPercent,
        entryPrice,
        stopLossPrice,
        conviction,
      });
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid request";
      if (
        msg.includes("must be") ||
        msg.includes("must differ") ||
        msg.includes("positive") ||
        msg.includes("LOW")
      ) {
        return res.status(400).json({ error: msg });
      }
      next(e);
    }
  });

  return router;
}
