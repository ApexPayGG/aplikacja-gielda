import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  calculateDividendCompound,
  type DividendCompoundResult,
} from "../modules/dividendcalc/dividendCalcModule";

type DividendCalcRouteDeps = {
  calculateFn: (params: {
    initialAmount: number;
    monthlyContribution: number;
    dividendYield: number;
    years: number;
  }) => DividendCompoundResult;
};

export function createDividendCalcRouter(depsInput?: Partial<DividendCalcRouteDeps>): Router {
  const deps: DividendCalcRouteDeps = {
    calculateFn: depsInput?.calculateFn ?? calculateDividendCompound,
  };

  const router = Router();

  router.post(
    "/api/dividend/compound/calculate",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as Record<string, unknown>;
        const initialAmount = Number(body.initialAmount);
        const monthlyContribution = Number(body.monthlyContribution);
        const dividendYield = Number(body.dividendYield);
        const years = Number(body.years);

        if (
          !Number.isFinite(initialAmount) ||
          !Number.isFinite(monthlyContribution) ||
          !Number.isFinite(dividendYield) ||
          !Number.isFinite(years)
        ) {
          return res.status(400).json({
            error:
              "initialAmount, monthlyContribution, dividendYield, and years must be numbers",
          });
        }

        const result = deps.calculateFn({
          initialAmount,
          monthlyContribution,
          dividendYield,
          years,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Invalid request";
        if (
          msg.includes("must be") ||
          msg.includes("must be <=") ||
          msg.includes("non-negative")
        ) {
          return res.status(400).json({ error: msg });
        }
        next(error);
      }
    },
  );

  return router;
}
