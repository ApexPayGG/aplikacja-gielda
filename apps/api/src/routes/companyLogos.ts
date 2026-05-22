import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { resolveCompanyLogosForTickers } from "../modules/companies/companyLogoLookup";

function parseSymbolsParam(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 100);
}

export function createCompanyLogosRouter(): Router {
  const router = Router();

  router.get("/api/companies/logos", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const symbols = parseSymbolsParam(req.query.symbols);
      if (symbols.length === 0) {
        return res.status(400).json({ error: "Missing query parameter symbols (comma-separated)" });
      }

      const lookup = await resolveCompanyLogosForTickers(symbols);
      const items = symbols.map((symbol) => {
        const row = lookup.get(symbol);
        return {
          symbol,
          logoUrl: row?.logoUrl ?? null,
          name: row?.name ?? null,
          exchange: row?.exchange ?? null,
        };
      });

      res.json({ items, count: items.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
